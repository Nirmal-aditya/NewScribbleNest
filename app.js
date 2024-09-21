const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multerconfig = require('./config/multerconfig');
const connectDB = require('./db'); // Ensure this connects to MongoDB

const app = express();
const port = process.env.PORT || 3000;

// Async IIFE to start the server
(async () => {
    const db = await connectDB();

    // Middleware
    app.set('view engine', 'ejs');
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(multerconfig.single("image")); // Apply multer as middleware

    // Routes
    app.get('/', (req, res) => {
        res.render('index');
    });

    app.get('/profile/upload', (req, res) => {
        res.render('profileupload');
    });

    app.post('/upload', isLoggedIn, async (req, res) => {
        try {
            const user = await db.collection('users').findOne({ email: req.user.email });

            if (req.file) {
                await db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { profilepic: req.file.filename } }
                );
                res.redirect('/profile');
            } else {
                res.status(400).send('No file uploaded.');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).send('Error uploading file.');
        }
    });

    app.post('/register', async (req, res) => {
        const { email, password, username, name, age } = req.body;

        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) return res.status(400).send('User Already Registered');

        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = {
                username,
                email,
                age,
                name,
                password: hashedPassword,
                posts: [] // Initialize posts array
            };

            const result = await db.collection('users').insertOne(newUser);
            const token = jwt.sign({ email: email, userid: result.insertedId }, 'shhh');
            res.cookie('token', token);
            res.send('Registered');
        } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).send('Error during registration.');
        }
    });

    app.post('/login', async (req, res) => {
        const { email, password } = req.body;

        const user = await db.collection('users').findOne({ email });
        if (!user) return res.status(400).send('Invalid email or password');

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign({ email: email, userid: user._id }, 'shhh');
            res.cookie('token', token);
            return res.status(200).redirect('profile');
        } else {
            res.redirect('/login');
        }
    });

    app.get('/profile', isLoggedIn, async (req, res) => {
        const user = await db.collection('users').findOne({ email: req.user.email });
        if (!user) return res.status(404).send('User not found');

        const posts = await db.collection('posts').find({ user: user._id }).toArray();
        res.render('profile', { user, posts });
    });

    app.get('/like/:id', isLoggedIn, async (req, res) => {
        const post = await db.collection('posts').findOne({ _id: new ObjectId(req.params.id) });

        if (post.likes.includes(req.user.userid)) {
            await db.collection('posts').updateOne(
                { _id: post._id },
                { $pull: { likes: req.user.userid } }
            );
        } else {
            await db.collection('posts').updateOne(
                { _id: post._id },
                { $addToSet: { likes: req.user.userid } }
            );
        }

        res.redirect('/profile');
    });

    app.get('/edit/:id', isLoggedIn, async (req, res) => {
        const post = await db.collection('posts').findOne({ _id: new ObjectId(req.params.id) });
        res.render('edit', { post });
    });

    app.post('/update/:id', isLoggedIn, async (req, res) => {
        await db.collection('posts').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { content: req.body.content } }
        );
        res.redirect('/profile');
    });

    app.post('/delete/:id', isLoggedIn, async (req, res) => {
        try {
            const post = await db.collection('posts').findOneAndDelete({ _id: new ObjectId(req.params.id) });
            if (!post) return res.status(404).send('Post not found');

            await db.collection('users').updateOne(
                { _id: post.user },
                { $pull: { posts: post._id } }
            );

            res.redirect('/profile');
        } catch (error) {
            console.error('Error deleting post:', error);
            res.status(500).send('Error deleting post');
        }
    });

    app.post('/post', isLoggedIn, async (req, res) => {
        const user = await db.collection('users').findOne({ email: req.user.email });
        const { content } = req.body;

        const post = {
            user: user._id,
            content,
            likes: [] // Initialize likes array
        };

        const result = await db.collection('posts').insertOne(post);
        await db.collection('users').updateOne(
            { _id: user._id },
            { $push: { posts: result.insertedId } }
        );

        res.redirect('/profile');
    });

    app.get('/login', (req, res) => {
        res.render('login');
    });

    app.get('/logout', (req, res) => {
        res.cookie('token', '');
        res.redirect('/login');
    });

    // Middleware to check if user is logged in
    function isLoggedIn(req, res, next) {
        const token = req.cookies.token;

        if (!token) {
            return res.redirect('/login');
        }

        try {
            const data = jwt.verify(token, 'shhh');
            req.user = data;
            next();
        } catch (err) {
            console.error('Token verification error:', err);
            res.redirect('/login');
        }
    }

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
})();

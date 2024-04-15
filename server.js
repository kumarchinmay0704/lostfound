const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');

const app = express();
app.use(cors());

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'forms','uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now());
    }
});
const upload = multer({ storage: storage });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uri = 'mongodb+srv://harshin783:bmsce@lostandfound.u2denuv.mongodb.net/?retryWrites=true&w=majority&appName=LostandFound';
const dbName = 'LostandFound';

async function connectToMongoDB() {
    const client = new MongoClient(uri, { useNewUrlParser: true });
    try {
        await client.connect();
        console.log('Connected to MongoDB server');
        const db = client.db(dbName);
        return { client, db };
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

app.use(express.static(path.join(__dirname, 'forms')));
app.use(express.static(path.join(__dirname, 'forms','uploads')));


// Define route handler for the register page (GET request)
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'forms', 'register.html'));
});

// Define route handler for user registration (POST request)
app.post('/api/register', async (req, res) => {
    const { fullName, email, phone, year, branch, password } = req.body;
    const { client, db } = await connectToMongoDB();

    try {
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const result = await db.collection('users').insertOne({ fullName, email, phone, year, branch, password });

        await client.close();
        return res.status(201).json({ success: true, message: 'Registration successful!' });
    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while registering user' });
    }
});


// Define route handler for the login page (GET request)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'forms', 'login.html'));
});

// Define route handler for user login (POST request)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const { client, db } = await connectToMongoDB();

    try {
        const user = await db.collection('users').findOne({ email, password });
        if (user) {
            return res.status(200).json({ success: true, message: 'Login successful!', user });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ success: false, message: 'An error occurred while logging in' });
    } finally {
        await client.close();
    }
});

// Define route handler for the submit-item page (GET request)
app.get('/submit-item', (req, res) => {
    res.sendFile(path.join(__dirname, 'forms', 'lost&found.html'));
});

// Define route handler for submitting an item (POST request)
app.post('/api/submit-item', upload.array('images'), async (req, res) => {
    const { status, name, email, contactNo, item, location, date, description } = req.body;
    const images = req.files.map(file => file.filename);
    const { client, db } = await connectToMongoDB();

    try {
        // Check if an item with all parameters matching already exists
        const checkItem = await db.collection('items').findOne({ name, email, item, description, status });

        if (checkItem) {
            // If an item with all parameters matching exists, return similar item exists message
            await client.close();
            return res.status(400).json({ success: false, message: 'Similar item already exists' });
        }

        // Check if an item with matching name and description but opposite status exists
        const oppositeStatusItem = await db.collection('items').findOne({ item, description, status: { $ne: status } });

        if (oppositeStatusItem) {
            const matchingItems = await db.collection('items').find({
                item,
                description,
                status: { $ne: status } // Opposite status
            }).toArray();
            await client.close();
            return res.status(400).json({ success: false, message: 'We have a match', matchingItems });
        }

        // Store the new item in the database
        await db.collection('items').insertOne({ status, name, email, contactNo, item, location, date, description, images });

        await client.close();
        return res.status(201).json({ success: true, message: 'Item registered successfully!' });
    } catch (error) {
        console.error('Error submitting item:', error);
        await client.close();
        return res.status(500).json({ success: false, message: 'An error occurred while registering item' });
    }
});

// Retrieve matching items with opposite statuses
app.get('/api/matching-items', async (req, res) => {
    const { item, description, status } = req.query; // Retrieve the status parameter from the request query
    const { client, db } = await connectToMongoDB();

    try {
        const matchingItems = await db.collection('items').find({
            item,
            description,
            status: { $ne: status } // Use the retrieved status parameter here
        }).toArray();

        return res.status(200).json({ success: true, items: matchingItems });
    } catch (error) {
        console.error('Error retrieving matching items:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while retrieving matching items' });
    } finally {
        await client.close();
    }
});

app.put('/api/mark-claimed/:itemId', async (req, res) => {
    const itemId = req.params.itemId;
    const { client, db } = await connectToMongoDB();

    try {
        const result = await db.collection('items').deleteOne({ _id: new ObjectId(itemId) });

        if (result.deletedCount > 0) {
            return res.status(200).json({ success: true, message: 'Item marked as claimed and deleted successfully' });
        } else {
            return res.status(404).json({ success: false, message: 'Item not found or already marked as claimed' });
        }
    } catch (error) {
        console.error('Error marking item as claimed:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while marking item as claimed' });
    } finally {
        await client.close();
    }
});

// Define route handler for the contact form submission (POST request)
app.post('/api/contact', async (req, res) => {
    const { name, email, phone, desc } = req.body;
    const { client, db } = await connectToMongoDB();

    try {
        const result = await db.collection('contact').insertOne({ name, email, phone, desc });
        await client.close();
        return res.status(201).json({ success: true, message: 'Contact information stored successfully!' });
    } catch (error) {
        console.error('Error storing contact information:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while storing contact information' });
    }
});

// Route to serve the contact form
app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'forms', 'contactus.html'));
});

app.get('/api/list-items', async (req, res) => {
    console.log('GET request received at /api/list-items');
    const { client, db } = await connectToMongoDB();
    try {
        const items = await db.collection('items').find({}).toArray();
        console.log('Items:', items); // Log retrieved items
        res.status(200).json({ success: true, items });
    } catch (error) {
        console.error('Error retrieving items:', error);
        res.status(500).json({ success: false, message: 'An error occurred while retrieving items' });
    } finally {
        await client.close();
    }
});

const listItemsRoute = require('./routes/listitems'); 
app.use('/api/list-items', listItemsRoute);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser')
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6qre6yi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db('SiteListMyWebsite').collection('users');
        const allSitesCollection = client.db('SiteListMyWebsite').collection('AllWebsites');
        const pendingCollection = client.db('SiteListMyWebsite').collection('Pending');
        const allSubscriberCollection = client.db('SiteListMyWebsite').collection('Subscriber');
        const favouriteCollection = client.db('SiteListMyWebsite').collection('Favourite');


        // user related api ---------
        // user data 
        app.put('/users', async (req, res) => {
            const user = req.body;

            const options = { upsert: true };
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "user already exist", insertedId: null })
            }
            const updatedDoc = {
                $set: {
                    ...user
                }
            }
            const result = await usersCollection.updateOne(query, updatedDoc, options);
            res.send(result);
        });

        // get the admin 
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const user = await usersCollection.findOne({ email: email });

                if (user) {
                    res.status(200).json({ role: user.role });
                } else {
                    res.status(404).json({ message: 'User not found' });
                }
            } catch (error) {
                res.status(500).json({ message: 'Server error', error });
            }
        });

        app.get("/users", async (req, res) =>{
            const allUsers = await usersCollection.find().toArray();
            res.send(allUsers);
        })

        app.delete('/deleteUser/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        });


        // Website related api --------------- 

        // get all sites
        app.get('/allSites', async (req, res) => {
            const allSites = await allSitesCollection.find().toArray();
            res.send(allSites);
        });

        app.get('/pending-sites', async (req, res) => {
            const personalSites = await pendingCollection.find().toArray();
            res.send(personalSites);
        });

        // get single site
        app.get('/allSites/:id', async (req, res) => {
            const siteId = req.params.id;
            try {
                const singleSite = await allSitesCollection.findOne({ _id: new ObjectId(siteId) });
                if (singleSite) {
                    res.send(singleSite);
                } else {
                    res.status(404).send({ message: 'Site not found' });
                }
            } catch (error) {
                res.status(500).send({ message: 'Error fetching site', error });
            }
        });

        // Approving website from pending list 
        app.post('/approve/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const site = await pendingCollection.findOne({ _id: new ObjectId(id) });
                if (!site) {
                    return res.status(404).json({ message: 'Site not found in pending collection' });
                }

                await allSitesCollection.insertOne(site);

                await pendingCollection.deleteOne({ _id: new ObjectId(id) });

                res.status(200).json({ message: 'Site approved and moved to AllWebsites collection' });
            } catch (error) {
                console.error('Error approving site:', error);
                res.status(500).json({ message: 'Error approving site', error });
            }
        });

        // finding website throw email 
        app.get('/personalSites', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const websites = await allSitesCollection.find(query).toArray();
            res.send(websites);
        });

        // post the subscriber to the database
        app.post('/subscribe', async (req, res) => {
            const newSubscriber = req.body;
            const result = await allSubscriberCollection.insertOne(newSubscriber);
            res.send(result);
        });

        // latest sites 
        app.get('/latest-sites', async (req, res) => {
            try {
                const result = await allSitesCollection.find({}).sort({ date: -1 }).limit(4).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching latest surveys:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // post favourite to the favourite collection
        app.post('/favourite', async (req, res) => {
            try {
                const { email, websiteId, name, link, logo, image, category, description } = req.body;

                // Check if the website is already a favorite for this user
                const existingFavourite = await favouriteCollection.findOne({ email, websiteId });
                if (existingFavourite) {
                    return res.status(400).send({ message: 'This website is already in your favorites.' });
                }

                // Add the new favorite
                const favourite = { email, websiteId, name, link, logo, image, category, description };
                const result = await favouriteCollection.insertOne(favourite);

                res.status(201).send(result);
            } catch (error) {
                res.status(500).send({ message: 'Failed to add favorite.', error });
            }
        });

        // getFavourite 
        app.get('/getFavourite', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const favourite = await favouriteCollection.find(query).toArray();
            res.send(favourite);
        });

        app.delete('/deleteFavourite/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const query = { _id: new ObjectId(id) };
                const result = await favouriteCollection.deleteOne(query);

                if (result.deletedCount === 1) {
                    res.status(200).json({ message: "Successfully deleted favourite" });
                } else {
                    res.status(404).json({ message: "Favourite not found" });
                }
            } catch (error) {
                res.status(500).json({ message: "Failed to delete favourite", error: error.message });
            }
        });


        // post website
        app.post('/submitedWebsite', async (req, res) => {
            const newWebsite = req.body;

            try {
                // Check if the website name or link already exists
                const existingWebsite = await allSitesCollection.findOne({
                    $or: [{ name: newWebsite.name }, { link: newWebsite.link }]
                });

                if (existingWebsite) {
                    // If website already exists, send a response with a message
                    return res.status(400).send({ message: "Website name or link already exists" });
                }

                // Insert the new website if it doesn't exist
                const result = await pendingCollection.insertOne(newWebsite);
                res.status(200).send(result);
            } catch (error) {
                console.error("Error adding website:", error);
                res.status(500).send({ message: "Internal server error" });
            }
        });

        // update website
        app.put('/updateSite/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateData = req.body;

            const updatedDocument = {
                $set: {
                    name: updateData.name,
                    link: updateData.link,
                    category: updateData.category,
                    profession: updateData.profession,
                    image: updateData.image,
                    logo: updateData.logo,
                    description: updateData.description,
                }
            };

            try {
                const options = { upsert: false };
                const result = await allSitesCollection.updateOne(filter, updatedDocument, options);

                if (result.modifiedCount === 1) {
                    res.status(200).send({ message: 'Website updated successfully', result });
                } else {
                    res.status(404).send({ message: 'Website not found or no changes made' });
                }
            } catch (error) {
                console.error('Error updating site:', error);
                res.status(500).send({ message: 'Error updating site', error });
            }
        });


        // Delete website 
        app.delete('/deleteSite/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allSitesCollection.deleteOne(query);
            res.send(result);
        });
        
        // delete site from pending list 
        app.delete('/deletePendingSite/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await pendingCollection.deleteOne(query);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
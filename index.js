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

        const allSitesCollection = client.db('SiteListMyWebsite').collection('AllWebsites');
        const allSubscriberCollection = client.db('SiteListMyWebsite').collection('Subscriber');
        const favouriteCollection = client.db('SiteListMyWebsite').collection('Favourite');

        // get all sites
        app.get('/allSites', async (req, res) => {
            const allSites = await allSitesCollection.find().toArray();
            res.send(allSites);
        })

        // finding website throw email 
        app.get('/personalSites', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const websites = await allSitesCollection.find(query).toArray();
            res.send(websites);
        })

        // post the subscriber to the database
        app.post('/subscribe', async (req, res) => {
            const newSubscriber = req.body;
            const result = await allSubscriberCollection.insertOne(newSubscriber);
            res.send(result);
        })

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
        })

        app.delete('/deleteFavourite/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await favouriteCollection.deleteOne(query);
            res.send(result);
        });


        app.post('/submitedWebsite', async (req, res) => {
            const newWebsite = req.body;
            const result = await allSitesCollection.insertOne(newWebsite);
            res.send(result);
        })

        app.put('/submitedWebsite/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateSite = req.body
            const book = {
                $set: {
                    name: updateSite.name,
                    link: updateSite.link,
                    category: updateSite.category,
                    subCategory: updateSite.subCategory,
                    description: updateSite.description,
                }
            }
            const result = await allSitesCollection.updateOne(filter, book, options)
            res.send(result)

        })

        app.delete('/deleteSite/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allSitesCollection.deleteOne(query);
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
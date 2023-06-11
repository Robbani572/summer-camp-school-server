const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config()

// middlewares
app.use(express.json())
app.use(cors())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uvrlcrq.mongodb.net/?retryWrites=true&w=majority`;

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

        const courseData = client.db('artistryMoth').collection('courses');
        const usersData = client.db('artistryMoth').collection('users');
        const cartsData = client.db('artistryMoth').collection('carts');

        // users api

        app.get('/users', async(req, res) => {
            const result = await usersData.find().toArray();
            res.send(result)
        })

        app.post('/users', async(req, res) => {
            const user = req.body;
            console.log(user)
            const query = {email: user.email};
            const existingUser = await usersData.findOne(query);
            if(existingUser){
                return res.send({message: 'User already exist'})
            }
            const result = await usersData.insertOne(user);
            res.send(result)
        })

        app.patch('/users/:id', async(req, res) => {
            const id = req.params.id
            const filter = {_id: new ObjectId(id)}
            const updateUser = req.body;
            const updateDoc = {
                $set: {
                  role: updateUser.role
                },
              };
            const result = await usersData.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.delete('/users/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await usersData.deleteOne(query)
            res.send(result)
        })

        // course apis
        app.get('/courses', async (req, res) => {
            const result = await courseData.find().sort({ enrolledStudents: -1 }).toArray()
            res.send(result)
        })

        // carts api

        app.get('/carts', async(req, res) => {
            const userEmail = req.query.email;
            if(!userEmail){
                return res.send([])
            }
            const query = {email: userEmail}
            const result = await cartsData.find(query).toArray()
            res.send(result)
        })

        app.post('/carts', async(req, res) => {
            const item = req.body;
            console.log(item)
            const result = await cartsData.insertOne(item)
            res.send(result)
        })

        app.delete('/carts/:id', async(req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = {_id: new ObjectId(id)}
            const result = await cartsData.deleteOne(query)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('The world is beautiful and we are trying to make it more beautiful')
})

app.listen(port, () => {
    console.log(`Artistry moth is running on port: ${port}`);
})
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { emit } = require('nodemon');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config()

// middlewares
app.use(express.json())
app.use(cors())


const jwtVerify = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


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

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const userEmail = req.decoded.email;
            const query = { email: userEmail }
            const user = await usersData.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next()
        }

        // users api

        app.get('/users', jwtVerify, verifyAdmin, async (req, res) => {
            // const userEmail = req.query.email;
            // const decodedEmail = req.decoded.email;
            // if(userEmail !== decodedEmail){
            //     return res.status(403).send({error: true, message: 'forbidden access'})
            // }
            const result = await usersData.find().toArray();
            res.send(result)
        })

        app.get('/user', async (req, res) => {
            const userEmail = req.query.email;
            if (!userEmail) {
                return res.send([])
            }
            const filter = { email: userEmail }
            const result = await usersData.findOne(filter)
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersData.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exist' })
            }
            const result = await usersData.insertOne(user);
            res.send(result)
        })

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updateUser = req.body;
            const updateDoc = {
                $set: {
                    role: updateUser.role
                },
            };
            const result = await usersData.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersData.deleteOne(query)
            res.send(result)
        })

        // course apis
        app.get('/courses', async (req, res) => {
            const result = await courseData.find().sort({ enrolledStudents: -1 }).toArray()
            res.send(result)
        })

        app.post('/courses', async (req, res) => {
            const course = req.body;
            const result = await courseData.insertOne(course)
            res.send(result)
        })

        // carts api

        app.get('/carts', jwtVerify, async (req, res) => {
            const userEmail = req.query.email;
            console.log(userEmail)
            if (!userEmail) {
                return res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (userEmail !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: userEmail }
            const result = await cartsData.find(query).toArray()
            res.send(result)
        })

        app.get('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartsData.findOne(query);
            res.send(result)
        })

        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartsData.insertOne(item)
            res.send(result)
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartsData.deleteOne(query)
            res.send(result)
        })

        // payment method intent
        app.post('/create-payment-intent', jwtVerify, async (req, res) => {
            // const userEmail = req.query.email;
            // const decodedEmail = req.decoded.email;
            // if(userEmail !== decodedEmail){
            //     return res.status(403).send({error: true, message: 'forbidden access'})
            // }
            // const userEmail = req.decoded.email;
            // const query = { email: userEmail }
            // const user = await usersData.findOne(query)
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
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
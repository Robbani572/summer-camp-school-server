const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;
const app = express();


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
        // await client.connect();

        const courseData = client.db('artistryMoth').collection('courses');
        const usersData = client.db('artistryMoth').collection('users');
        const cartsData = client.db('artistryMoth').collection('carts');
        const instructorData = client.db('artistryMoth').collection('instructor');
        const feedbackData = client.db('artistryMoth').collection('feedback');
        const paymentData = client.db('artistryMoth').collection('payments');

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

            const updatedUser = await usersData.findOne(filter)
            const instructorUpdated = {
                instructorId: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                img: updatedUser.img
            }

            let insertInstructor = {};
            let deleteInstructor;

            if (updatedUser.role === 'instructor') {
                insertInstructor = await instructorData.insertOne(instructorUpdated)
            }
            // const instructorQuery = {role: updatedUser.role}

            const deleteQuery = { instructorId: updatedUser._id }

            if (updatedUser.role === 'admin') {
                deleteInstructor = await instructorData?.deleteOne(deleteQuery)
            }


            res.send({ result, insertInstructor, deleteInstructor })
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersData.deleteOne(query)
            res.send(result)
        })

        // instructor api
        app.get('/instructors', async(req, res) => {
            const result = await instructorData.find().toArray()
            res.send(result)
        })

        app.get('/instructors/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await instructorData.findOne(query)
            res.send(result)
        })

        // course apis
        app.get('/courses', async (req, res) => {
            const result = await courseData.find().sort({ enrolledStudents: -1 }).toArray()
            res.send(result)
        })

        app.patch('/courses/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updateUser = req.body;
            const updateDoc = {
                $set: {
                    status: updateUser.status
                },
            };
            const result = await courseData.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.put('/courses/:id', async (req, res) => {
            const id = req.params.id;
            const feedback = req.body;
            const updateDoc = {
                $set: {
                    feedback: feedback
                },
            };
            const filter = { _id: new ObjectId(id) }
            const result = await courseData.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.post('/courses', async (req, res) => {
            const course = req.body;
            const result = await courseData.insertOne(course)
            res.send(result)
        })

        // student feedback api
        app.get('/feedback', async(req, res) => {
            const result = await feedbackData.find().toArray()
            res.send(result)
        })


        // carts api

        app.get('/carts', jwtVerify, async (req, res) => {
            const userEmail = req.query.email;
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
            const { amount } = req.body;
            const price = parseFloat(amount);
            const total = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: total,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // payment collection apis

        app.get('/payments', jwtVerify, async (req, res) => {
            const userEmail = req.query.email;
            if (!userEmail) {
                return res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (userEmail !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { user: userEmail }
            const result = await paymentData.find(query).toArray()
            res.send(result)
        })

        app.post('/payments', jwtVerify, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentData.insertOne(payment)
            const filter = { _id: new ObjectId(payment.selectedCalss) }

            const courseCollection = await courseData.findOne(filter)


            const updateDoc = {
                $set: {
                    availableSeats: courseCollection.availableSeats - 1,
                    enrolledStudents: courseCollection.enrolledStudents + 1,
                },
            };


            const updatedResult = await courseData.updateOne(filter, updateDoc)

            const query = { _id: new ObjectId(payment.cartItem) }
            const deleteResult = await cartsData.deleteOne(query)
            res.send({ insertResult, deleteResult, updatedResult })
        })



        // Send a ping to confirm a successful connection
        // client.db("admin").command({ ping: 1 });
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
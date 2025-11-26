const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_GET);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cewig2g.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("zapShiftDB");
    const parcelsCollection = db.collection("parcels");
    const paymentCollection = db.collection("payment")

    // Parcel API
    app.get("/parcels", async (req, res) => {
      const query = {};
      const { email } = req.query;
      if (email) {
        query.senderEmail = email;
      }
      const options = { sort: { createAt: -1 } };
      const cursor = parcelsCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.findOne(query);
      res.send(result);
    });
    // Parcel Create API
    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      // Parcel Create Time
      parcel.createAt = new Date();
      const result = await parcelsCollection.insertOne(parcel);
      res.send(result);
    });

    // Parcel Delete API
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.deleteOne(query);
      res.send(result);
    });

    // Payment Related API
    app.post("/checkout-payment", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.cost) * 100;

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "USD",
                unit_amount: amount,
                product_data: {
                  name: `Please pay for: ${paymentInfo.parcelName}`,
                },
              },
              quantity: 1,
            },
          ],
          customer_email: paymentInfo.senderEmail,
          mode: "payment",
          metadata: {
            parcelId: paymentInfo.parcelId,
            parcelName: paymentInfo.parcelName
          },
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
        });

        console.log(session);
        res.send({ url: session.url });
      } catch (error) {
        console.error("PAYMENT ERROR:", error);
        res.status(500).send({ message: error.message });
      }
    });

    // payment checked 
    app.patch('/payment-success', async (req, res)=> {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      console.log('session retrieve', session);
      if (session.payment_status === 'paid') {
        const id = session.metadata.parcelId;
        const query = {_id: new ObjectId(id)}
        const update = {
          $set: {
            paymentStatus: 'paid',
          }
        }
        const result = await parcelsCollection.updateOne(query, update);

        const payment = {
          amount: session.amount_total/100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId: session.metadata.parcelId,
          parcelName: session.metadata.parcelName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: ''
        }

        if (session.payment_status === 'paid') {
          const resultPayment = await paymentCollection.insertOne(payment)
          res.send({success: true, modifyParcel: result, paymentInfo: resultPayment})
        }
      }
      res.send({success: false})
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Zap is shifting !");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

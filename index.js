const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');  // Import crypto for signature verification

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Razorpay instance
const razorpay = new Razorpay({
    key_id: 'rzp_test_KF2rr8SNTk1Bbn',
    key_secret: 'qM3kJV29dXqlsCUldI5hBKhe',
});

// Function to read data from JSON file
const readData = () => {
    if (fs.existsSync('orders.json')) {
        const data = fs.readFileSync('orders.json');
        return JSON.parse(data);
    }
    return [];
};

// Function to write data to JSON file
const writeData = (data) => {
    fs.writeFileSync('orders.json', JSON.stringify(data, null, 2));
};

// Initialize orders.json if it doesn't exist
if (!fs.existsSync('orders.json')) {
    writeData([]);
}

app.post('/test', (req, res) => {
    res.send('test');
});

// Route to handle order creation
app.post('/create-order', async (req, res) => {
    try {
        const { amount, currency, receipt, notes } = req.body;
        const options = {
            amount: amount * 100, // Convert amount to paise
            currency,
            receipt,
            notes,
        };
        const order = await razorpay.orders.create(options);
        // Read current orders, add new order, and write back to the file
        const orders = readData();
        orders.push({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
            status: 'created',
        });
        writeData(orders);
        res.json(order); // Send order details to frontend, including order ID
        console.log(order);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating order');
    }
});

app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

// Route to handle payment verification
app.post('/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const secret = razorpay.key_secret;
    const body = razorpay_order_id + '|' + razorpay_payment_id;

    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Update the order with payment details
            const orders = readData();
            const order = orders.find(o => o.order_id === razorpay_order_id);
            if (order) {
                order.status = 'paid';
                order.payment_id = razorpay_payment_id;
                writeData(orders);
            }

            res.status(200).json({ status: 'ok' });
            console.log('Payment verification successful');
        } else {
            res.status(400).json({ status: 'verification_failed' });
            console.log('Payment verification failed');
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Error verifying payment' });
    }
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

const express = require('express');
const {  MongoClient } = require('mongodb');
const {ObjectId} = require('bson')
const cors = require('cors');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cron = require('node-cron');
const app = express();


require('dotenv').config()

app.use(express.json());
app.use(cors());



let client;
const initializeDBAndServer = async () => {
    const username = encodeURIComponent(process.env.USER_NAME);
    const password = encodeURIComponent(process.env.PASSWORD);

    const uri = `mongodb+srv://${username}:${password}@cluster0.yqd3ckv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

    client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB.....");
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port: ${process.env.PORT}`);
        });
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
};

initializeDBAndServer();


// Sheduler it will trigger every day night 12 O'clock, and update the overDue loans

cron.schedule('0 0 * * *', async () => {
    const db = client.db(process.env.DATABASE_NAME);
    const loanCollection = db.collection(process.env.LOANS_COLLECTION_NAME); 
    await loanCollection.updateMany({ dueDate: { $lt: new Date() } , status : {$ne : "completed"}}, { $set: { status: "overDue" }})
});

// Middleware to authenticate JWT token
const authenticateJwtToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
        jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
        response.status(401);
        response.send({ error: "Invalid JWT Token" });
    } else {
        jwt.verify(jwtToken, process.env.SECRET_TOKEN, async (error, payload) => {
            if (error) {
                response.status(401);
                response.send({ error: "Invalid JWT Token" });
            } else {
                request.userId = payload.userId;
                next();
            }
        });
    }
};

// Middleware function to check the ownership 
const checkOwnership = async (request,response,next) =>{
    const customerId = request.params.id 
    const userId = request.userId 
    const collection = client.db(process.env.DATABASE_NAME).collection(process.env.CUSTOMERS_COLLECTION_NAME);

    if (!ObjectId.isValid(customerId)) return response.status(400).send({ error: "Invalid customer ID format" });

    const getCustomerDetails = await collection.findOne({_id : new ObjectId(`${customerId}`)})
    if(!getCustomerDetails){
        return response.status(404).send({error : "Resource NOT found"})
    }
    if(`${getCustomerDetails.createdBy}` === `${userId}`){
        next()
    }else{
        return response.status(401).send({error : "Unathorized"})
    }
}



// Endpoint to register a new user
app.post('/register', async (request, response) => {
    try {
        const collection = client.db(process.env.DATABASE_NAME).collection(process.env.USERS_COLLECTION_NAME); 
        const userDetails = request.body; 
        const { email } = userDetails;
        const isUserExist = await collection.find({ email }).toArray();
        if (isUserExist.length === 0) {
            const hashedPassword = await bcrypt.hash(userDetails.password, 10);
            userDetails.password = hashedPassword;
            const result = await collection.insertOne(userDetails);
            response.status(200)
            response.send({ yourId: result.insertedId, message: "User registered successfuly" });
        } else {
            response.status(401);
            response.send({ errorMsg: 'User with this Email ID already exists' })
        }
    } catch (error) {
        response.status(500)
        response.send({ "Internal server error:": error });
    }
});

// Endpoint to log in a user
app.post('/login', async (request, response) => {
    try {
      
        const collection = client.db(process.env.DATABASE_NAME).collection(process.env.USERS_COLLECTION_NAME); 
        const userDetails = request.body;
        const { email, password } = userDetails;
        const isUserExist = await collection.findOne({email});
        
        if (!isUserExist) {
            response.status(401)
            response.send({ errorMsg: "User with this Email ID doesn't exist" });
            return;
        }
        const isPasswordMatched = await bcrypt.compare(password, isUserExist.password);
        if (isPasswordMatched) {
            const token = jwt.sign({ userId: isUserExist._id }, process.env.SECRET_TOKEN,{ expiresIn: '1d' });
            response.status(200)
            response.send({ jwtToken: token, userId: isUserExist._id });
        } else {
            response.status(401)
            response.send({ errorMsg: "Incorrect password" });
        }
    } catch (error) {
        response.status(500)
        response.send({ "Internal server error:": error });
    }
});

// Endpoint to get user data by userId
app.post('/getUserData/:userId',authenticateJwtToken, async (request, response) => {
    try {
        const collection = client.db(process.env.DATABASE_NAME).collection(process.env.USERS_COLLECTION_NAME); 
        const { userId } = request.params;

        if (!ObjectId.isValid(userId)) return response.status(400).send({ error: "Invalid user ID format" });

        if( `${userId}` !== `${request.userId}` ){
            return response.status(401).send({error : "Unathorized"})
        }
        
        const result = await collection.findOne(new ObjectId(userId));
        
        response.status(200)
        response.send({ username: result.email,_id : result._id });
    } catch (error) {
        response.status(500)
        response.send({ "Internal server error:": error });
    }
});



// Endpoint to create a new customer
app.post('/add-customer', authenticateJwtToken, async (request, response) => {
    try {
        const collection = client.db(process.env.DATABASE_NAME).collection(process.env.CUSTOMERS_COLLECTION_NAME); 
        const customerDetails = request.body; 
        const {phone, trustScore } = customerDetails;
        const isCustomerExist = await collection.find({ phone }).toArray();
        const intTrustScore = parseInt(trustScore)

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return response.status(400).send({ errorMsg: 'Phone number must be exactly 10 digits' });
        }

        
        if (isCustomerExist.length === 0) {
            if (intTrustScore >= 1 && intTrustScore <= 10) {
                customerDetails.trustScore = intTrustScore;

                customerDetails.createdBy = request.userId
        
                const result = await collection.insertOne(customerDetails);
                response.status(200).send({ yourId: result.insertedId, message: "Customer Added successfully" });
        
            } else {
                response.status(400).send({ errorMsg: 'trustScore must be a number between 1 and 10' });
            }
        } else {
            response.status(401).send({ errorMsg: 'Customer with this Phone Number already exists' });
        }
    } catch (error) {
        response.status(500)
        response.send({ "Internal server error:": error });
    }
});

// Endpoint to Update Customer 
app.put('/update-customer/:id', authenticateJwtToken,checkOwnership, async (request, response) => {
    try {
        const id = request.params.id;
        const updateData = { ...request.body };

        if (!ObjectId.isValid(id)) return response.status(400).send({ error: "Invalid customer ID format" });

        if ('phone' in updateData) {
            delete updateData.phone;
        }

        if ('trustScore' in updateData) {
            const trustScore = Number(updateData.trustScore);
            if (isNaN(trustScore) || trustScore < 1 || trustScore > 10) {
                return response.status(400).send({ error: 'trustScore must be a number between 1 and 10' });
            }
            updateData.trustScore = trustScore; 
        }

        const collection = client.db(process.env.DATABASE_NAME).collection(process.env.CUSTOMERS_COLLECTION_NAME);

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return response.status(404).send({ message: 'Customer not found' });
        }

        response.status(200).send({ message: 'Customer updated successfully' });

    } catch (error) {
        response.status(500).send({ error: 'Internal Server Error', details: error.message });
    }
});

// Endpoint to get customer data by customerId
app.post('/getCustomerData/:id',authenticateJwtToken,checkOwnership, async (request, response) => {
    try {
        const collection = client.db(process.env.DATABASE_NAME).collection(process.env.CUSTOMERS_COLLECTION_NAME); 
        const { id } = request.params;
        if (!ObjectId.isValid(id)) return response.status(400).send({ error: "Invalid customer ID format" });
        const result = await collection.findOne(new ObjectId(id));
        
        response.status(200)
        response.send({ result});
    } catch (error) {
        response.status(500)
        response.send({ "Internal server error:": error });
    }
});



// Endpoint to Delete customer 
app.delete('/delete-customer/:id', authenticateJwtToken,checkOwnership, async (request, response) => {
    try {
        const id = request.params.id;
        const collection = client.db(process.env.DATABASE_NAME).collection(process.env.CUSTOMERS_COLLECTION_NAME);

        if (!ObjectId.isValid(id)) return response.status(400).send({ error: "Invalid customer ID format" });
        

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
            response.status(200).send({ message: 'Customer deleted successfully' });
        } else {
            response.status(404).send({ message: 'Customer not found' });
        }
    } catch (error) {
        response.status(500).send({ error: 'Internal Server Error', details: error.message });
    }
});


// Endpoint to create-loan
app.post('/create-loan', authenticateJwtToken, async (request, response) => {
    const collection = client.db(process.env.DATABASE_NAME).collection(process.env.CUSTOMERS_COLLECTION_NAME);
    try {
        const {
            customerId,
            itemDescription,
            loanAmount,
            issueDate,
            dueDate,
            frequency,
            interestPercent = 0,
            graceDays = 0
        } = request.body;
        const userId = request.userId
        if (!ObjectId.isValid(customerId)) return response.status(400).send({ error: "Invalid customer ID format" });
        const isCustomerExist = await collection.findOne({_id : new ObjectId(`${customerId}`)})

  
        if(`${isCustomerExist.createdBy}` !== `${userId}`){
            return response.status(401).send({error : "Unathorized"})
        }

        

        if(!isCustomerExist){
            return response.status(400).send({"error" : "Customer Id invalid"})
        }
        
        if (!customerId || !itemDescription || !loanAmount || !issueDate || !dueDate || !frequency) {
            return response.status(400).send({ errorMsg: "Required fields missing" });
        }

        const db = client.db(process.env.DATABASE_NAME);
        const loanCollection = db.collection(process.env.LOANS_COLLECTION_NAME); 

        const newLoan = {
            customerId,
            itemDescription,
            loanAmount: Number(loanAmount),
            issueDate: new Date(issueDate),
            dueDate: new Date(dueDate),
            frequency,
            interestPercent: Number(interestPercent),
            graceDays: Number(graceDays),
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy : request.userId
        };

        const result = await loanCollection.insertOne(newLoan);

        response.status(201).send({
            message: "Loan created successfully",
            loanId: result.insertedId
        });

    } catch (error) {
        console.error(error);
        response.status(500).send({ errorMsg: "Internal server error" });
    }
});


//Endpoint to update Loan status 

app.put('/update-loan/:id', authenticateJwtToken, async (request,response)=>{
    const loanDetails = request.body 
    const loanId = request.params.id 
    const {status} = loanDetails 

    if (!ObjectId.isValid(loanId)) return response.status(400).send({ error: "Invalid Loan ID format" });
    

    if(status !== 'pending' && status !== 'completed'){
        return response.status(400).send({error : "Enter valid inputs pending/completed"})
    }

    const db = client.db(process.env.DATABASE_NAME);
    const loanCollection = db.collection(process.env.LOANS_COLLECTION_NAME); 

    const result = await loanCollection.updateOne({_id : new ObjectId(loanId), createdBy : {$eq : new ObjectId(`${request.userId}`)}},
    {$set : {status} })
    if(result.matchedCount === 0){
        return response.status(400).send({error : "Invalid loan ID / Unathorized"})
    }else{
        return response.status(200).send({message : "Loan updated successfully"})
    }
    
    
})


// Fetch Loans with status / all

app.post('/loans', authenticateJwtToken, async (request,response)=>{
    const {status = "all"} = request.body
    const userId = request.userId 

    if(status !== 'pending' && status !== 'completed' && status !== 'overDue' && status !== 'all'){
        return response.status(400).send({error : "Invalid input, Enter only pending/completed/overDue/all"})
    }

    const db = client.db(process.env.DATABASE_NAME);
    const loanCollection = db.collection(process.env.LOANS_COLLECTION_NAME); 

    const loans = await loanCollection.find(status === "all" ?{createdBy : new ObjectId(`${userId}`) } :{createdBy : new ObjectId(`${userId}`) ,status : status}).toArray()

    if(loans.length === 0){
        return response.status(404).send({error : "Resource NOT found"})
    }
    response.status(200)
    response.send(loans)
})


# CrediKhaata

CrediKhaata is a simple credit and loan management system built with Node.js and MongoDB. It allows users to register, manage customers, and create/update loan records. It also supports JWT-based user authentication and user scoping.

## Setup Instructions

1. **Clone the repository**

```bash
   git clone <your-repo-url>
   cd CrediKhaata
```

2. **Install dependencies**

```bash
   npm install express
   npm install mongodb
   npm install dotenv
   npm install jsonwebtoken
   npm install bcryptjs
   npm install node-cron
   npm install cors
```

3. **Create a `.env` file** with the following environment variables:

```
PORT=3000
DATABASE_NAME=your_database_name
USERS_COLLECTION_NAME=users
CUSTOMERS_COLLECTION_NAME=customers
LOANS_COLLECTION_NAME=loans
SECRET_KEY=your_jwt_secret_key
```

4. **Run the project**

```bash
   node server.js
```

---

## API Endpoints and Sample Requests

### User Registration

```http
POST http://localhost:3000/register
Content-Type: application/json

{
  "email": "example@gmail.com",
  "password": "password123"
}
```

### User Login

```http
POST http://localhost:3000/login
Content-Type: application/json

{
  "email": "example@gmail.com",
  "password": "password123"
}
```

### Get User Details by ID

```http
POST http://localhost:3000/getUserData/<userId>
Authorization: Bearer <your-jwt-token>
```

### Get Customer Details by ID

```http
POST http://localhost:3000/getCustomerData/<customerId>
Authorization: Bearer <your-jwt-token>
```

### Add Customer

```http
POST http://localhost:3000/add-customer/
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Revi",
  "phone": 5000032222,
  "address": "1-4, ganapavaram",
  "trustScore": 10,
  "creditLimit": "1000"
}
```

### Update Customer

```http
PUT http://localhost:3000/update-customer/<customerId>
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Prabhas Raj",
  "trustScore": "10"
}
```

### Delete Customer

```http
DELETE http://localhost:3000/delete-customer/<customerId>
Authorization: Bearer <your-jwt-token>
```

### Create Loan

```http
POST http://localhost:3000/create-loan/
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "customerId": "<customerId>",
  "itemDescription": "mobile",
  "loanAmount": 10000,
  "issueDate": "2025-05-05",
  "dueDate": "2025-05-20",
  "frequency": "monthly",
  "interestPercent": 7,
  "graceDays": 10
}
```

### Update Loan

```http
PUT http://localhost:3000/update-loan/<loanId>
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "status": "pending"
}
```

### Fetch Loans by Status

Allowed status values: `pending`, `completed`, `overDue`, `all`

```http
POST http://localhost:3000/loans/
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "status": "all"
}
```

---

## Notes

* JWT tokens must be sent in the `Authorization` header as: `Bearer <token>`.
* User actions are scoped: only data created by a user can be accessed by that user.
* Use `node-cron` for automated daily checks to update loan statuses to `overDue` based on the due date.
* Use `ObjectId` matching carefully, always cast strings to `ObjectId` when querying by `_id` in MongoDB.

---


const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");

const app = express();
const PORT = process.env.PORT || 3000;
const scryptAsync = promisify(crypto.scrypt);

// ===============================
// MIDDLEWARE
// ===============================

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
    res.redirect("/signup.html#login");
});

app.use((req, res, next) => {
    console.log(
        `[LOG] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`
    );
    next();
});

// ===============================
// MONGODB CONNECTION
// ===============================

mongoose
    .connect(
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/milemark"
    )
    .then(() => console.log("MongoDB connected successfully"))
    .catch((error) =>
        console.log("MongoDB connection error:", error.message)
    );

// ===============================
// USER SIGNUP SCHEMA
// ===============================

const userSchema = new mongoose.Schema(
    {
        fname: {
            type: String,
            required: true,
            trim: true
        },
        lname: {
            type: String,
            required: true,
            trim: true
        },
        uname: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        dob: {
            type: String,
            required: true
        },
        pwd: {
            type: String,
            required: true,
            select: false
        },
        mobile: {
            type: String,
            required: true
        },
        postal: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        }
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// ===============================
// SIGNUP VALIDATION RULES
// ===============================

const signupRules = {
    fname: [/^[A-Za-z]{3,}$/, "Invalid First Name"],
    lname: [/^[A-Za-z]{3,}$/, "Invalid Last Name"],
    uname: [/^[A-Za-z0-9_]{5,}$/, "Invalid Username"],
    dob: [/^\d{4}-\d{2}-\d{2}$/, "Select DOB"],
    pwd: [/^(?=.*[A-Z])(?=.*\W).{8,}$/, "Invalid Password"],
    mobile: [/^[6-9][0-9]{9}$/, "Invalid Mobile"],
    postal: [/^[0-9]{6}$/, "Invalid Postal Code"],
    email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid Email"]
};

// In-memory user store fallback when MongoDB is not running locally
const inMemoryUsers = [];

function isValidPastDate(dateString) {
    if (!signupRules.dob[0].test(dateString)) {
        return false;
    }

    const date = new Date(`${dateString}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        return false;
    }

    // Reject impossible dates such as 2020-02-31.
    if (date.toISOString().slice(0, 10) !== dateString) {
        return false;
    }

    // Date of birth must be in the past.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return date < today;
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = await scryptAsync(password, salt, 64);

    return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
    try {
        if (!storedHash || typeof storedHash !== "string") return false;
        const [salt, key] = storedHash.split(":");
        if (!salt || !key) return false;
        const derivedKey = await scryptAsync(password, salt, 64);
        return crypto.timingSafeEqual(
            Buffer.from(key, "hex"),
            derivedKey
        );
    } catch (e) {
        return false;
    }
}

// ===============================
// SIGNUP API
// POST /api/signup
// ===============================

app.post("/api/signup", async (req, res) => {
    try {
        const {
            fname,
            lname,
            uname,
            dob,
            pwd,
            mobile,
            postal,
            email
        } = req.body || {};

        const data = {
            fname: typeof fname === "string" ? fname.trim() : "",
            lname: typeof lname === "string" ? lname.trim() : "",
            uname: typeof uname === "string" ? uname.trim() : "",
            dob: typeof dob === "string" ? dob.trim() : "",
            pwd: typeof pwd === "string" ? pwd : "",
            mobile: typeof mobile === "string" ? mobile.trim() : "",
            postal: typeof postal === "string" ? postal.trim() : "",
            email: typeof email === "string" ? email.trim() : ""
        };

        // Validate every required field with defined regex and error message
        for (const [field, [pattern, errorMessage]] of Object.entries(signupRules)) {
            if (!pattern.test(data[field])) {
                return res.status(400).json({
                    success: false,
                    field,
                    message: errorMessage
                });
            }
        }

        // Validate that the DOB is a real past date.
        if (!isValidPastDate(data.dob)) {
            return res.status(400).json({
                success: false,
                field: "dob",
                message: "Select DOB"
            });
        }

        // Normalize username and email.
        data.uname = data.uname.toLowerCase();
        data.email = data.email.toLowerCase();

        // 1. If MongoDB is connected, save into MongoDB
        if (mongoose.connection.readyState === 1) {
            const existingUser = await User.findOne({
                $or: [
                    { uname: data.uname },
                    { email: data.email }
                ]
            });

            if (existingUser) {
                if (existingUser.uname === data.uname) {
                    return res.status(409).json({
                        success: false,
                        field: "uname",
                        message: "Username already exists"
                    });
                }

                return res.status(409).json({
                    success: false,
                    field: "email",
                    message: "Email already registered"
                });
            }

            const hashedPassword = await hashPassword(data.pwd);

            const newUser = await User.create({
                fname: data.fname,
                lname: data.lname,
                uname: data.uname,
                dob: data.dob,
                pwd: hashedPassword,
                mobile: data.mobile,
                postal: data.postal,
                email: data.email
            });

            console.log("[MongoDB] New user registered:", newUser.uname);

            return res.status(201).json({
                success: true,
                message: "Account created successfully!",
                user: {
                    id: newUser._id,
                    fname: newUser.fname,
                    lname: newUser.lname,
                    uname: newUser.uname,
                    email: newUser.email
                }
            });
        }

        // 2. In-Memory fallback (when local MongoDB daemon is not running)
        const duplicate = inMemoryUsers.find(
            (u) => u.uname === data.uname || u.email === data.email
        );

        if (duplicate) {
            if (duplicate.uname === data.uname) {
                return res.status(409).json({
                    success: false,
                    field: "uname",
                    message: "Username already exists"
                });
            }
            return res.status(409).json({
                success: false,
                field: "email",
                message: "Email already registered"
            });
        }

        const hashedPassword = await hashPassword(data.pwd);
        const newUser = {
            id: "user_" + Date.now(),
            fname: data.fname,
            lname: data.lname,
            uname: data.uname,
            dob: data.dob,
            pwd: hashedPassword,
            mobile: data.mobile,
            postal: data.postal,
            email: data.email,
            createdAt: new Date().toISOString()
        };

        inMemoryUsers.push(newUser);
        console.log("[In-Memory Store] New user registered:", newUser.uname);

        return res.status(201).json({
            success: true,
            message: "Account created successfully!",
            user: {
                id: newUser.id,
                fname: newUser.fname,
                lname: newUser.lname,
                uname: newUser.uname,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error("Signup error:", error);

        if (error.code === 11000) {
            const duplicateField = Object.keys(
                error.keyPattern || {}
            )[0];

            return res.status(409).json({
                success: false,
                field: duplicateField,
                message:
                    duplicateField === "uname"
                        ? "Username already exists"
                        : "Email already registered"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to create account. Please try again."
        });
    }
});

// ===============================
// LOGIN API
// POST /api/login
// ===============================

app.post("/api/login", async (req, res) => {
    try {
        const { identifier, pwd } = req.body || {};

        if (!identifier || !pwd) {
            return res.status(400).json({
                success: false,
                message: "Please enter your username/email and password."
            });
        }

        const id = identifier.trim().toLowerCase();

        // 1. If MongoDB is connected
        if (mongoose.connection.readyState === 1) {
            const user = await User.findOne({
                $or: [{ uname: id }, { email: id }]
            }).select("+pwd");

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid username/email or password."
                });
            }

            const isMatch = await verifyPassword(pwd, user.pwd);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid username/email or password."
                });
            }

            console.log("[MongoDB] User logged in:", user.uname);

            return res.json({
                success: true,
                message: "Login successful!",
                user: {
                    id: user._id,
                    fname: user.fname,
                    lname: user.lname,
                    uname: user.uname,
                    email: user.email
                }
            });
        }

        // 2. In-Memory fallback
        const user = inMemoryUsers.find(
            (u) => u.uname.toLowerCase() === id || u.email.toLowerCase() === id
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid username/email or password."
            });
        }

        const isMatch = await verifyPassword(pwd, user.pwd);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username/email or password."
            });
        }

        console.log("[In-Memory] User logged in:", user.uname);

        return res.json({
            success: true,
            message: "Login successful!",
            user: {
                id: user.id,
                fname: user.fname,
                lname: user.lname,
                uname: user.uname,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to process login. Please try again."
        });
    }
});

// GET /api/users (Inspect registered users without passwords)
app.get("/api/users", async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const users = await User.find({}, "-pwd");
            return res.json({ count: users.length, users });
        }
        const users = inMemoryUsers.map(({ pwd, ...safe }) => safe);
        return res.json({ count: users.length, users, storage: "in-memory" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===============================
// VEHICLE SCHEMA
// ===============================

const vehicleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    pricePerDay: {
        type: Number,
        required: true
    },
    available: {
        type: Boolean,
        default: true
    },
    seats: {
        type: Number,
        default: 5
    },
    gear: {
        type: String,
        default: "Auto"
    },
    fuel: {
        type: String,
        default: "Petrol"
    }
});

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

// ===============================
// RENTAL SCHEMA
// ===============================

const rentalSchema = new mongoose.Schema({
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
        required: true
    },
    vehicleName: {
        type: String,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    days: {
        type: Number,
        required: true
    },
    totalCost: {
        type: Number,
        required: true
    },
    pickupLocation: {
        type: String,
        default: "Downtown — Fleet St. Depot"
    }
});

const Rental = mongoose.model("Rental", rentalSchema);

// ===============================
// GET ALL VEHICLES
// ===============================

app.get("/api/vehicles", async (req, res) => {
    try {
        const { type, available } = req.query;
        const filter = {};

        if (type && type !== "All") {
            filter.type = {
                $regex: new RegExp(`^${type}$`, "i")
            };
        }

        if (available !== undefined) {
            filter.available = available === "true";
        }

        const vehicles = await Vehicle.find(filter);
        res.json(vehicles);
    } catch (error) {
        console.error("Get vehicles error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// GET VEHICLE BY ID
// ===============================

app.get("/api/vehicles/:id", async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                error: "Vehicle not found."
            });
        }

        res.json(vehicle);
    } catch (error) {
        res.status(400).json({
            error: "Invalid vehicle ID."
        });
    }
});

// ===============================
// ADD NEW VEHICLE
// ===============================

app.post("/api/vehicles", async (req, res) => {
    try {
        const {
            name,
            type,
            pricePerDay,
            seats,
            gear,
            fuel
        } = req.body;

        if (!name || !type || !pricePerDay) {
            return res.status(400).json({
                error: "Please provide vehicle name, type, and daily price."
            });
        }

        const newVehicle = new Vehicle({
            name: name.trim(),
            type,
            pricePerDay: Number(pricePerDay),
            available: true,
            seats: Number(seats) || 5,
            gear: gear || "Auto",
            fuel: fuel || "Petrol"
        });

        await newVehicle.save();

        console.log("Vehicle added:", newVehicle.name);

        res.status(201).json({
            message: "Vehicle added to fleet successfully!",
            vehicle: newVehicle
        });
    } catch (error) {
        console.error("Add vehicle error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// RENT VEHICLE
// ===============================

app.post("/api/rent/:id", async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                error: "Vehicle not found."
            });
        }

        if (!vehicle.available) {
            return res.status(400).json({
                error: "This vehicle is already rented."
            });
        }

        const {
            customerName,
            days,
            pickupLocation
        } = req.body;

        const rentDays = Number(days) || 1;

        if (!Number.isInteger(rentDays) || rentDays < 1) {
            return res.status(400).json({
                error: "Rental days must be a positive whole number."
            });
        }

        const totalCost = vehicle.pricePerDay * rentDays;

        vehicle.available = false;
        await vehicle.save();

        const rental = new Rental({
            vehicleId: vehicle._id,
            vehicleName: vehicle.name,
            customerName: customerName
                ? customerName.trim()
                : "Customer",
            days: rentDays,
            totalCost,
            pickupLocation:
                pickupLocation || "Downtown — Fleet St. Depot"
        });

        await rental.save();

        res.json({
            message: `Vehicle '${vehicle.name}' reserved successfully!`,
            rental
        });
    } catch (error) {
        console.error("Rent vehicle error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// RETURN VEHICLE
// ===============================

app.put("/api/return/:id", async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                error: "Vehicle not found."
            });
        }

        vehicle.available = true;
        await vehicle.save();

        await Rental.deleteMany({
            vehicleId: vehicle._id
        });

        res.json({
            message: `Vehicle '${vehicle.name}' returned successfully!`
        });
    } catch (error) {
        console.error("Return vehicle error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// DELETE VEHICLE
// ===============================

app.delete("/api/vehicles/:id", async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                error: "Vehicle not found."
            });
        }

        await Vehicle.findByIdAndDelete(req.params.id);

        await Rental.deleteMany({
            vehicleId: vehicle._id
        });

        res.json({
            message: `Vehicle '${vehicle.name}' deleted successfully!`,
            deletedVehicle: vehicle
        });
    } catch (error) {
        console.error("Delete vehicle error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// GET ALL RENTALS
// ===============================

app.get("/api/rentals", async (req, res) => {
    try {
        const rentals = await Rental.find();
        res.json(rentals);
    } catch (error) {
        console.error("Get rentals error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// GET STATISTICS
// ===============================

app.get("/api/stats", async (req, res) => {
    try {
        const total = await Vehicle.countDocuments();

        const available = await Vehicle.countDocuments({
            available: true
        });

        const rented = await Rental.countDocuments();

        res.json({
            total,
            available,
            rented
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// SEED ORIGINAL VEHICLES
// ===============================

app.post("/api/seed", async (req, res) => {
    try {
        const existingVehicles = await Vehicle.countDocuments();

        if (existingVehicles > 0) {
            return res.json({
                message: "Vehicles already exist in MongoDB."
            });
        }

        const vehicles = [
            {
                name: "Honda Civic Sport",
                type: "Compact",
                pricePerDay: 45,
                available: true,
                seats: 5,
                gear: "Auto",
                fuel: "Petrol"
            },
            {
                name: "Toyota RAV4 Hybrid",
                type: "SUV",
                pricePerDay: 68,
                available: true,
                seats: 5,
                gear: "AWD",
                fuel: "Hybrid"
            },
            {
                name: "BMW 330i M-Sport",
                type: "Sedan",
                pricePerDay: 85,
                available: true,
                seats: 5,
                gear: "Auto",
                fuel: "Petrol"
            },
            {
                name: "Porsche Macan GTS",
                type: "Luxury",
                pricePerDay: 135,
                available: true,
                seats: 5,
                gear: "Auto",
                fuel: "Petrol"
            },
            {
                name: "Yamaha MT-07",
                type: "Bike",
                pricePerDay: 35,
                available: true,
                seats: 2,
                gear: "Manual",
                fuel: "Petrol"
            },
            {
                name: "Tesla Model 3",
                type: "Compact",
                pricePerDay: 60,
                available: false,
                seats: 5,
                gear: "Electric",
                fuel: "Electric"
            }
        ];

        await Vehicle.insertMany(vehicles);

        res.json({
            message: "Original vehicles added successfully!"
        });
    } catch (error) {
        console.error("Seed error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
    console.log("===============================================");
    console.log("Milemark Vehicle Rental Server running");
    console.log(`Webpage: http://localhost:${PORT}`);
    console.log("===============================================");
});

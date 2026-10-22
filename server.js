const express = require("express");
const mongoose = require("mongoose");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Logger
app.use((req, res, next) => {
    console.log(
        `[LOG] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`
    );
    next();
});

// ===============================
// MongoDB Connection
// ===============================

mongoose
    .connect("mongodb://localhost:27017/milemark")
    .then(() => console.log("MongoDB connected successfully"))
    .catch((error) => console.log("MongoDB connection error:", error));

// ===============================
// Vehicle Schema
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
// Rental Schema
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

// =====================================================
// GET ALL VEHICLES
// =====================================================

app.get("/api/vehicles", async (req, res) => {
    try {
        const { type, available } = req.query;

        let filter = {};

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
        console.log(error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// GET VEHICLE BY ID
// =====================================================

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

// =====================================================
// ADD NEW VEHICLE
// =====================================================

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
            type: type,
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
        console.log("Add vehicle error:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// RENT VEHICLE
// =====================================================

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
            totalCost: totalCost,
            pickupLocation:
                pickupLocation || "Downtown — Fleet St. Depot"
        });

        await rental.save();

        res.json({
            message: `Vehicle '${vehicle.name}' reserved successfully!`,
            rental: rental
        });

    } catch (error) {
        console.log("Rent vehicle error:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// RETURN VEHICLE
// =====================================================

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
        console.log("Return vehicle error:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// DELETE VEHICLE
// =====================================================

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
        console.log("Delete vehicle error:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// GET ALL RENTALS
// =====================================================

app.get("/api/rentals", async (req, res) => {
    try {
        const rentals = await Rental.find();

        res.json(rentals);

    } catch (error) {
        console.log(error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// GET STATISTICS
// =====================================================

app.get("/api/stats", async (req, res) => {
    try {
        const total = await Vehicle.countDocuments();

        const available = await Vehicle.countDocuments({
            available: true
        });

        const rented = await Rental.countDocuments();

        res.json({
            total: total,
            available: available,
            rented: rented
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// SEED ORIGINAL VEHICLES
// =====================================================

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

        console.log("Seed error:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log("===============================================");
    console.log("🚗 Milemark Vehicle Rental Server running");
    console.log(`🌐 Webpage: http://localhost:${PORT}`);
    console.log("===============================================");

});
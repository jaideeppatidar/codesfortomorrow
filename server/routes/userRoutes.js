const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const authenticateToken = require('../middleware/authMiddleware');
const jwtSecret = 'qwertyuiop';
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const emailCheckResult = await sql.query`
        SELECT COUNT(*) AS count FROM dbo.Users WHERE Email = ${email}
      `;
        if (emailCheckResult.recordset[0].count > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await sql.query`
        INSERT INTO dbo.Users (Email, Password)
        VALUES (${email}, ${hashedPassword})
      `;
        console.log('User registered successfully with email:', email);
        res.status(200).json({ message: 'User registered successfully', success: true });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await sql.query`
            SELECT * FROM dbo.Users WHERE Email = ${email}
        `;
        if (userResult.recordset.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const user = userResult.recordset[0];
        const isPasswordValid = await bcrypt.compare(password, user.Password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign({ userId: user.Id, email: user.Email }, jwtSecret, { expiresIn: '1h' });
        res.status(200).json({ token, message: 'Login successful', success: true });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/category',authenticateToken, async (req, res) => {
    const { cataegoryName } = req.body;
    try {
        const result = await sql.query`
            INSERT INTO Category (cataegoryName)
            VALUES (${cataegoryName})
        `;
        console.log('Category registered:', result);
        res.status(200).json({ message: 'Category registered successfully' });
    } catch (error) {
        console.error('Error registering customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/category',authenticateToken, async (req, res) => {
    try {
        const result = await sql.query`
        SELECT categoryId ,
        CataegoryName FROM dbo.category
        `;
        console.log('Customers retrieved:', result);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error retrieving customers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/category/:categoryId', authenticateToken, async (req, res) => {
    const { categoryId } = req.params;
    const { cataegoryName } = req.body;
    try {
        const result = await sql.query`
            UPDATE  dbo.Category 
            SET cataegoryName = ${cataegoryName}
            WHERE categoryId = ${categoryId}
        `;
        console.log('Category updated:', result);
        res.status(200).json({ message: 'Category updated successfully' });
    } catch (error) {
        console.error('Error updating Category:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/category/:categoryId', authenticateToken, async (req, res) => {
    const { categoryId } = req.params;
    try {
        const result = await sql.query`
        DELETE FROM
        dbo.Category 
        WHERE categoryId = ${categoryId}
        `;
        console.log('Category deleted:', result);
        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting Category:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//services api create 
router.post('/services', authenticateToken, async (req, res) => {
    const { categoryId, serviceName, type, prices } = req.body;

    if (!categoryId || !serviceName || !type || !prices || !Array.isArray(prices) || prices.length === 0) {
        return res.status(400).json({ error: 'Invalid input' });
    }
    if (!['Normal', 'VIP'].includes(type)) {
        return res.status(400).json({ error: 'Invalid service type' });
    }
    const transaction = new sql.Transaction();
    try {
        await transaction.begin();

        const serviceRequest = new sql.Request(transaction);
        const serviceResult = await serviceRequest.query`
            INSERT INTO dbo.Services (CategoryId, ServiceName, Type)
            OUTPUT INSERTED.ServiceId
            VALUES (${categoryId}, ${serviceName}, ${type})
        `;
        const serviceId = serviceResult.recordset[0].ServiceId;

        for (const price of prices) {
            const priceRequest = new sql.Request(transaction);
            await priceRequest.query`
                INSERT INTO dbo.ServicePrices (ServiceId, Price)
                VALUES (${serviceId}, ${price})
            `;
        }
        await transaction.commit();
        res.status(201).json({ message: 'Service added successfully', success: true });
    } catch (error) {
        await transaction.rollback();
        console.error('Error adding service:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/services', authenticateToken, async (req, res) => {
    try {
        const result = await sql.query`
        SELECT s.ServiceId, s.serviceName, s.type,
        c.CataegoryName, sp.price
        FROM dbo.Services s
        JOIN dbo.Category c ON s.categoryId = c.categoryId
        LEFT JOIN dbo.ServicePrices sp ON s.ServiceId = sp.ServiceId
        `;
        
        const servicesMap = {};
        result.recordset.forEach(row => {
            if (!servicesMap[row.ServiceId]) {
                servicesMap[row.ServiceId] = {
                    serviceId: row.ServiceId,
                    serviceName: row.serviceName,
                    type: row.type,
                    categoryName: row.CategoryName,
                    prices: []
                };
            }
            if (row.price !== null) {
                servicesMap[row.ServiceId].prices.push(row.price);
            }
        });
        const services = Object.values(servicesMap);
        console.log('+++++++++', services);

        console.log('Services retrieved:', result);
        res.status(200).json(services);
    } catch (error) {
        console.error('Error retrieving services:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/services/:serviceId', authenticateToken, async (req, res) => {
    const { serviceId } = req.params;
    try {
        await sql.query`
            DELETE FROM dbo.ServicePrices WHERE ServiceId = ${serviceId}
        `;
        const result = await sql.query`
            DELETE FROM dbo.Services WHERE ServiceId = ${serviceId}
        `;
        if (result.rowsAffected[0] === 0) {
            res.status(404).json({ error: 'Service not found' });
        } else {
            res.status(200).json({ message: 'Service deleted successfully' });
        }
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/services/:serviceId', authenticateToken, async (req, res) => {
    const { serviceId } = req.params;
    const { serviceName, type, categoryId, price } = req.body;
    try {
        const transaction = new sql.Transaction();
        await transaction.begin();
        await transaction.request()
            .input('ServiceId', sql.Int, serviceId)
            .input('ServiceName', sql.NVarChar, serviceName)
            .input('Type', sql.NVarChar, type)
            .input('CategoryId', sql.Int, categoryId)
            .query(`
                UPDATE dbo.Services
                SET serviceName = @ServiceName,
                    type = @Type,
                    categoryId = @CategoryId
                WHERE ServiceId = @ServiceId
            `);
        if (price !== undefined) {
            await transaction.request()
                .input('ServiceId', sql.Int, serviceId)
                .input('Price', sql.Decimal(18, 2), price)
                .query(`
                    IF EXISTS (SELECT 1 FROM dbo.ServicePrices WHERE ServiceId = @ServiceId)
                        UPDATE dbo.ServicePrices
                        SET Price = @Price
                        WHERE ServiceId = @ServiceId
                    ELSE
                        INSERT INTO dbo.ServicePrices (ServiceId, Price)
                        VALUES (@ServiceId, @Price)
                `);
        }
        await transaction.commit();

        res.status(200).json({ message: 'Service updated successfully' });
    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }
        console.error('Error updating service:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/service-price-options', async (req, res) => {
    const { serviceId, duration, price, type } = req.body;
    if (!serviceId || !duration || !price || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (isNaN(price)) {
        return res.status(400).json({ error: 'Price must be a number' });
    }
    try {
        const result = await sql.query`
            INSERT INTO ServicePriceOptions (ServiceId, Duration, Price, Type)
            VALUES (${serviceId}, ${duration}, ${price}, ${type})
        `;
        console.log('Service price option added:', result);
        res.status(201).json({ message: 'Service price option added successfully' });
    } catch (error) {
        console.error('Error adding service price option:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/service-price-options', async (req, res) => {
    try {
       
        const result = await sql.query`
            SELECT * FROM ServicePriceOptions
        `;
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Error retrieving service price options:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/service-price-options/:id', async (req, res) => {
    const { id } = req.params; 
    const { serviceId, duration, price, type } = req.body;

    if (!serviceId || !duration || !price || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const existingOption = await sql.query`
            SELECT * FROM ServicePriceOptions WHERE ServiceID = ${id}
        `;
        if (!existingOption.recordset.length) {
            return res.status(404).json({ error: 'Service price option not found' });
        }
        await sql.query`
            UPDATE ServicePriceOptions
            SET ServiceID = ${serviceId}, Duration = ${duration}, Price = ${price}, Type = ${type}
            WHERE ServiceID = ${id}
        `;
        res.status(200).json({ message: 'Service price option updated successfully' });
    } catch (error) {
        console.error('Error updating service price option:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/service-price-options/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const existingOption = await sql.query`
            SELECT * FROM ServicePriceOptions WHERE ServiceID = ${id}
        `;

        if (!existingOption.recordset.length) {
            return res.status(404).json({ error: 'Service price option not found' });
        }
        await sql.query`
            DELETE FROM ServicePriceOptions WHERE ServiceID = ${id}
        `;

        res.status(200).json({ message: 'Service price option deleted successfully' });
    } catch (error) {
        console.error('Error deleting service price option:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

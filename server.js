const express = require("express");
const postgres = require("postgres");
const z = require("zod");

const app = express();
const port = 8000;
const sql = postgres({ db: "expressdb", user: "postgres", password: "password"});

app.use(express.json());

app.get("/", (req, res) => {
    res.send("o");
});

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});


const inName = str => sql`and name LIKE ${'%' + str + '%'}`;
const inAbout = str => sql`and about LIKE ${'%' + str + '%'}`;
const priceLessOrEqual = x => sql`and price <= ${x}`;

const ProductSchema = z.object({
    id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true});

app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);

    if (result.success) {
        const { name, about, price } = result.data;
        
        const product = await sql`
        INSERT INTO products (name, about, price)
        VALUES (${name}, ${about}, ${price})
        RETURNING *
        `;

        res.send(product[0]);
    } else {
        res.status(400).send(result);
    }
});

app.get("/AllProducts", async (req, res) => {

    const { name, about, price } = req.query;

    let nameB = false;
    let aboutB = false;
    let priceB = false;

    if (name) {
        nameB = true;
    }
    if (about) {
        aboutB = true;
    }
    if (price) {
        priceB = true;
    }
    console.log("test");
    const products = await sql`
    SELECT *
    FROM products
    WHERE name is not null
    ${name ? inName(name) : sql``}
    ${about ? inAbout(about) : sql``}
    ${price ? priceLessOrEqual(price) : sql``}
    ;`
    res.send(products);
})

app.get("/products/:id", async (req, res) => {
    const product = await sql`
        SELECT * FROM products WHERE id=${req.params.id}
        `;

    if (product.length > 0) {
        res.send(product[0]);
    } else {
        res.status(404).send({ message: "Not found" });
    }
});

app.delete("products/:id", async (req, res) => {
    const product = await sql`
        DELETE FROM products
        WHERE id=${req.params.id}
        RETURNING *
        `;

    if (product.length > 0) {
        res.send(product[0]);
    } else {
        res.status(404).send({ message: "Not found"});
    }
});



// Ressource Users


const UserSchema = z.object({
    username: z.string(),
    email: z.string().email(),
    password: z.string(),
});

const CreateUserSchema = UserSchema.omit({ id: true });

app.post("/users", async (req, res) => {
    const result = await CreateUserSchema.safeParse(req.body);

    if (result.success) {
        const { username, email, password } = result.data;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await sql`
            INSERT INTO users (username, email, password)
            VALUES (${username}, ${email}, ${hashedPassword})
            RETURNING *
        `;

        res.send(user[0]);
    } else {
        res.status(400).send(result);
    }
});

app.put("/users/:id", async (req, res) => {
    const { id } = req.params;
    const result = await UserSchema.safeParse(req.body);

    if (result.success) {
        const { username, email, password } = result.data;

        const hashedPassword = await bcrypt.hash(password, 10);

        const updatedUser = await sql`
            UPDATE users
            SET username = ${username}, email = ${email}, password = ${hashedPassword}
            WHERE id = ${id}
            RETURNING *
        `;

        if (updatedUser.length > 0) {
            res.send(updatedUser[0]);
        } else {
            res.status(404).send({ message: "User not found" });
        }
    } else {
        res.status(400).send(result);
    }
});

app.patch("/users/:id", async (req, res) => {
    const { id } = req.params;
    const result = await UserSchema.partial().safeParse(req.body);

    if (result.success) {
        const { username, email, password } = result.data;

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);

            await sql`
                UPDATE users
                SET password = ${hashedPassword}
                WHERE id = ${id}
            `;
        }

        const updatedUser = await sql`
            UPDATE users
            SET ${sql(result.data)}
            WHERE id = ${id}
            RETURNING *
        `;

        if (updatedUser.length > 0) {
            res.send(updatedUser[0]);
        } else {
            res.status(404).send({ message: "User not found" });
        }
    } else {
        res.status(400).send(result);
    }
});

const crypto = require('crypto');

const inUsername = str => sql`and username LIKE ${'%' + str + '%'}`;
const inEmail = str => sql`and email LIKE ${'%' + str + '%'}`;

app.get("/users", async (req, res) => {
    const { username, email } = req.query;

    try {
        const users = await sql`
            SELECT username, email, password FROM users
            WHERE 1=1
            ${username ? inUsername(username) : sql``}
            ${email ? inEmail(email) : sql``};
        `;

        const sanitizedUsers = users.map(user => ({
            username: user.username,
            email: user.email,
            password: crypto.createHash('sha512').update(user.password).digest('hex')
        }));

        res.send(sanitizedUsers);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Internal Server Error");
    }
});



// Système de recherche


app.get("/products", async (req, res) => {
    const { name, about, price } = req.query;

    try {
        const products = await sql`
            SELECT * FROM products
            WHERE 1=1
            ${name ? inName(name) : sql``}
            ${about ? inAbout(about) : sql``}
            ${price ? priceLessOrEqual(price) : sql``};
        `;

        res.send(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send("Internal Server Error");
    }
});
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
// Rendre le dossier uploads accessible publiquement via /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 1. S'assurer que les dossiers d'Upload existent
const uploadDirs = ['uploads', 'uploads/products', 'uploads/applications'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 2. Configuration de MULTER (Upload Produits)
const storageProducts = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/products/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'))
});
const uploadProduct = multer({ storage: storageProducts, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit pour images

// 3. Configuration de MULTER (Upload Candidatures Partenaires)
const storageApps = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/applications/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadApp = multer({ storage: storageApps, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// 4. Initialisation Base de de Données SQLite
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) console.error("Erreur connexion SQLite", err.message);
    else {
        console.log('✅ Connecté à la base de données SQLite.');
        
        // Table des utilisateurs
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT, prenom TEXT, email TEXT UNIQUE, password TEXT, genre TEXT,
            is_suspended INTEGER DEFAULT 0,
            role TEXT DEFAULT 'client'
        )`, () => {
            // MIGRATION Automatique si la table existait déjà sans ces colonnes
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if(columns) {
                    const colNames = columns.map(c => c.name);
                    if (!colNames.includes('role')) {
                        db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'client'", () => insertAdmin());
                    } else {
                        insertAdmin();
                    }
                    if (!colNames.includes('is_suspended')) {
                        db.run("ALTER TABLE users ADD COLUMN is_suspended INTEGER DEFAULT 0");
                    }
                }
            });
            function insertAdmin() {
                db.run(`INSERT OR IGNORE INTO users (nom, prenom, email, password, role) VALUES ('Gérant', 'Admin', 'admin@marcketingguy.com', 'admin123', 'admin')`);
            }
        });

        // Table de l'historique des connexions (Sécurité)
        // login_time enregistre la date ET l'heure
        db.run(`CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ip_address TEXT,
            country TEXT,
            device_type TEXT,
            device_brand TEXT,
            login_time DATETIME DEFAULT (datetime('now', 'localtime')),
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Table Catégories 
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        )`, () => {
            db.run(`INSERT OR IGNORE INTO categories (name) VALUES ('electronique'), ('services'), ('mode')`);
        });

        // Table des Produits E-Commerce
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titre TEXT, prix TEXT, categorie TEXT, shortDesc TEXT, longDesc TEXT,
            image_cover TEXT,
            vues INTEGER DEFAULT 0, likes INTEGER DEFAULT 0,
            stock_status TEXT DEFAULT 'En stock'
        )`);

        // Table des Candidatures (Partenaires/Livreurs)
        db.run(`CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT, prenom TEXT, naissance TEXT, lieu TEXT, domicile TEXT,
            doc_cnib TEXT, photo_visage TEXT,
            status TEXT DEFAULT 'En attente',
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )`);
        
        // L'Admin est dorénavant créé lors de la vérification/migration de la table 'users'.
    }
});

// A. Fonction d'analyse basique de l'appareil (User-Agent)
function parseUserAgent(ua) {
    let device_type = "Ordinateur (PC/Mac)";
    if (/Mobile|Android|iP(hone|od|ad)/.test(ua)) device_type = "Mobile / Tablette";
    
    let device_brand = "Inconnu";
    if(/iPhone/.test(ua)) device_brand = "Apple iPhone";
    else if(/iPad/.test(ua)) device_brand = "Apple iPad";
    else if(/Samsung/.test(ua)) device_brand = "Samsung";
    else if(/Huawei/.test(ua)) device_brand = "Huawei";
    else if(/Windows/.test(ua)) device_brand = "Windows PC";
    else if(/Macintosh/.test(ua)) device_brand = "MacBook / iMac";
    else if(/Linux/.test(ua)) device_brand = "Linux OS";
    else if(/Android/.test(ua)) device_brand = "Appareil Android";
    
    return { device_type, device_brand };
}

// ==========================================
// ROUTES : AUTHENTIFICATION & SÉCURITÉ
// ==========================================

// Inscription
app.post('/api/register', (req, res) => {
    const { nom, prenom, email, mot_de_passe, choix } = req.body;
    const sql = `INSERT INTO users (nom, prenom, email, password, genre) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [nom, prenom, email, mot_de_passe, choix], function(err) {
        if (err) return res.status(400).json({ success: false, message: 'Email déjà utilisé.' });
        res.json({ success: true, message: 'Inscription réussie.' });
    });
});

// Connexion Client Sécurisée avec Capture IP (Interdit au Gérant)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (err || !user) return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
        
        // SÉCURITÉ : Empêcher l'administrateur de se connecter sur cette interface publique
        if (user.role === 'admin') {
            return res.status(403).json({ success: false, message: '🛡️ Tentative bloquée. Veuillez utiliser le portail d\'administration secret.' });
        }

        if (user.is_suspended) return res.status(403).json({ success: false, message: '🚨 Accès Refusé : Votre compte a été suspendu par l\'administrateur.' });
        
        // Capture des informations de l'appareil
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const ua = req.headers['user-agent'] || '';
        const parsed = parseUserAgent(ua);
        const country = 'Côte d\'Ivoire (Local)'; 
        
        db.run(`INSERT INTO connections (user_id, ip_address, country, device_type, device_brand) VALUES (?, ?, ?, ?, ?)`, 
            [user.id, ip, country, parsed.device_type, parsed.device_brand], function(err) {
            
            res.json({ 
                success: true, 
                user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role },
                connection_id: this.lastID 
            });
        });
    });
});

// Connexion Gérant (Depuis le Portail Secret admin_login.html)
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (err || !user) return res.status(401).json({ success: false, message: 'Identifiants Gérant incorrects ou non reconnus.' });
        
        if (user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '🚨 Accès Réservé : Vous n\'avez pas d\'accréditation Gérant.' });
        }
        
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const ua = req.headers['user-agent'] || '';
        const parsed = parseUserAgent(ua);
        const country = 'Côte d\'Ivoire (Console Admin)'; 
        
        db.run(`INSERT INTO connections (user_id, ip_address, country, device_type, device_brand) VALUES (?, ?, ?, ?, ?)`, 
            [user.id, ip, country, parsed.device_type, parsed.device_brand], function(err) {
            
            res.json({ 
                success: true, 
                user: { id: user.id, nom: user.nom, email: user.email, role: user.role },
                connection_id: this.lastID 
            });
        });
    });
});

// Vérifier si la session est toujours active (Déconnexion à distance)
app.post('/api/check-session', (req, res) => {
    const { connection_id } = req.body;
    db.get(`SELECT is_active FROM connections WHERE id = ?`, [connection_id], (err, row) => {
        if (err || !row || row.is_active === 0) return res.json({ active: false });
        res.json({ active: true });
    });
});

// Récupérer l'historique d'un utilisateur specifique (Pour le Dashboard client)
app.get('/api/client/connections/:user_id', (req, res) => {
    db.all(`SELECT * FROM connections WHERE user_id = ? ORDER BY login_time DESC LIMIT 10`, [req.params.user_id], (err, rows) => {
        res.json({success: !err, connections: rows});
    });
});

// ==========================================
// ROUTES : BOUTIQUE (Produits & Catégories)
// ==========================================

// Afficher catégories
app.get('/api/categories', (req, res) => {
    db.all(`SELECT * FROM categories`, [], (err, rows) => {
        res.json({success: true, categories: rows});
    });
});

// Afficher les produits
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products ORDER BY id DESC`, [], (err, rows) => {
        res.json({ success: true, products: rows });
    });
});

// Admin : Ajouter produit AVEC IMAGE
app.post('/api/products', uploadProduct.single('image_cover'), (req, res) => {
    const { titre, prix, categorie, shortDesc, longDesc, stock_status } = req.body;
    
    if(!req.file) return res.status(400).json({success:false, message: "Une image de couverture est obligatoire !"});
    const filePath = `/uploads/products/${req.file.filename}`;

    const sql = `INSERT INTO products (titre, prix, categorie, shortDesc, longDesc, image_cover, stock_status) VALUES (?,?,?,?,?,?,?)`;
    db.run(sql, [titre, prix, categorie, shortDesc, longDesc, filePath, stock_status], function(err) {
        if(err) return res.status(500).json({success:false, message: err.message});
        res.json({success:true, message: "Produit publié avec succès !", product_id: this.lastID});
    });
});

// Produit : +1 Vue
app.post('/api/products/:id/view', (req, res) => {
    db.run(`UPDATE products SET vues = vues + 1 WHERE id = ?`, req.params.id, (err) => res.json({success: !err}));
});

// Produit : +1 Like
app.post('/api/products/:id/like', (req, res) => {
    db.run(`UPDATE products SET likes = likes + 1 WHERE id = ?`, req.params.id, (err) => res.json({success: !err}));
});


// ==========================================
// ROUTES : PARTENAIRES (Livreurs)
// ==========================================

app.post('/api/applications', uploadApp.fields([{name:'doc_cnib', maxCount:1}, {name:'photo_visage', maxCount:1}]), (req, res) => {
    const { nom, prenom, naissance, lieu, domicile } = req.body;
    
    if(!req.files || !req.files['doc_cnib'] || !req.files['photo_visage']) {
        return res.status(400).json({success:false, message: "Vous devez fournir votre pièce d'identité et votre photo !"});
    }
    
    const docPath = `/uploads/applications/${req.files['doc_cnib'][0].filename}`;
    const photoPath = `/uploads/applications/${req.files['photo_visage'][0].filename}`;

    const sql = `INSERT INTO applications (nom, prenom, naissance, lieu, domicile, doc_cnib, photo_visage) VALUES (?,?,?,?,?,?,?)`;
    db.run(sql, [nom, prenom, naissance, lieu, domicile, docPath, photoPath], function(err) {
        if(err) return res.status(500).json({success:false, message: "Erreur serveur : " + err.message});
        res.json({success:true, message: "Votre dossier a été envoyé à l'administration avec succès !"});
    });
});


// ==========================================
// ROUTES : ADMIN BACKOFFICE (GÉRANT)
// ==========================================

// Liste de tous les clients
app.get('/api/admin/clients', (req, res) => {
    db.all(`SELECT id, nom, prenom, email, is_suspended FROM users WHERE role = 'client'`, (err, rows) => {
        res.json({success: !err, clients: rows});
    });
});

// Liste des clients en ligne actuellement (is_active = 1)
app.get('/api/admin/connections/active', (req, res) => {
    db.all(`SELECT c.id as connection_id, c.ip_address, c.device_brand, c.login_time, u.nom, u.prenom 
            FROM connections c JOIN users u ON c.user_id = u.id 
            WHERE c.is_active = 1 ORDER BY login_time DESC`, (err, rows) => {
        res.json({success: !err, active_connections: rows});
    });
});

// Suspendre ou Activer un client
app.post('/api/admin/users/:id/suspend', (req, res) => {
    const { is_suspended } = req.body; // 1 ou 0
    db.run(`UPDATE users SET is_suspended = ? WHERE id = ?`, [is_suspended, req.params.id], (err) => {
        // Si suspendu, on tue ses connexions
        if(is_suspended === 1) db.run(`UPDATE connections SET is_active = 0 WHERE user_id = ?`, [req.params.id]);
        res.json({success: !err});
    });
});

// Tuer une session à distance (Déconnexion forcée)
app.post('/api/admin/connections/:id/kill', (req, res) => {
    db.run(`UPDATE connections SET is_active = 0 WHERE id = ?`, req.params.id, (err) => res.json({success: !err}));
});

// Liste des Candidatures Livreurs
app.get('/api/admin/applications', (req, res) => {
    db.all(`SELECT * FROM applications ORDER BY id DESC`, (err, rows) => {
        res.json({success: !err, applications: rows});
    });
});

// Ajouter une nouvelle catégorie
app.post('/api/admin/categories', (req, res) => {
    db.run(`INSERT INTO categories (name) VALUES (?)`, req.body.name, function(err) {
        if (err) return res.status(400).json({success:false, message: "Cette catégorie existe probablement déjà."});
        res.json({success: true, id: this.lastID});
    });
});

app.listen(PORT, () => console.log(`🚀 Serveur centralisé démarré avec succès sur http://localhost:${PORT}`));

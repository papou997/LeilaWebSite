document.addEventListener("DOMContentLoaded", () => {
    // SECURITY: Protect Boutique
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        alert("🚨 Espace Boutique Web Sécurisée : Vous devez vous connecter ou créer un compte.");
        window.location.href = 'html.html';
        return;
    }

    let products = [];
    const grid = document.getElementById('products-grid');
    const filters = document.querySelectorAll('.filter-btn');

    // WhatsApp Config
    const WHATSAPP_NUMBER = "2250102030405"; // Le numéro du gérant
    const serverURL = "http://localhost:3000";

    // CHARGER DEPUIS LA BASE DE DONNÉES
    async function loadProducts() {
        grid.innerHTML = "<p>✅ Connexion établie au serveur MGP Store... ⏳</p>";
        try {
            const res = await fetch(`${serverURL}/api/products`);
            const data = await res.json();
            if (data.success) {
                products = data.products;
                renderProducts(products);
            }
        } catch (e) {
            grid.innerHTML = "<p>⚠️ Le serveur Node.js est éteint. Demandez au Gérant d'ouvrir le terminal CMD et taper 'node server.js'.</p>";
        }
    }

    function generateShareStr() {
        return window.location.href; // Simulation du lien actuel 
    }

    // FUNCTION LIKER
    window.likeProduct = async (id, btn) => {
        btn.innerHTML = "❤️ Vous Aimez !";
        btn.style.color = "red";
        btn.style.borderColor = "red";
        btn.disabled = true;

        // Appel Serveur BDD
        await fetch(`${serverURL}/api/products/${id}/like`, { method: 'POST' });
        loadProducts(); // Reload to sync counts visually
    };

    function renderProducts(items) {
        grid.innerHTML = '';
        if (items.length === 0) {
            grid.innerHTML = '<p style="text-align:center;width:100%;">⚠️ La Boutique est vide. Le gérant n\'a posté aucun produit avec photo.</p>';
            return;
        }

        items.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            // Étiquette Stock
            const stockColor = product.stock_status.includes('En stock') ? '#10b981' : (product.stock_status.includes('Rupture') ? '#ef4444' : '#f59e0b');

            card.innerHTML = `
                <div class="product-badge" style="background:${stockColor}; padding:0.3rem 0.6rem; border-radius:12px; color:white; font-size:0.8rem; position:absolute; top:10px; right:10px; z-index:10; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.2);">${product.stock_status}</div>
                
                <div class="product-icon" style="background-image: url('${serverURL}${product.image_cover}'); background-size: cover; background-position: center; border-radius: 16px; min-height:180px; width:100%;"></div>
                
                <div class="product-info">
                    <h3 class="product-title">${product.titre}</h3>
                    <p class="product-desc">${product.shortDesc}</p>
                    <div class="product-price">${product.prix}</div>
                    
                    <div style="display:flex; justify-content:space-between; margin: 10px 0; font-size:0.85rem; color:#64748b; font-weight:600;">
                        <span>👁️ ${product.vues} Vues</span>
                        <span>❤️ ${product.likes} Likes</span>
                    </div>

                    <div class="product-actions" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem;">
                        <div style="display:flex; gap:0.5rem;">
                            <button class="btn btn-outline" style="flex:1;" onclick="likeProduct(${product.id}, this)">🤍 J'aime</button>
                            <button class="btn btn-outline" style="flex:1; border-color:var(--primary); color:var(--primary);" onclick="openProductModal(${product.id})">👀 Détails</button>
                        </div>
                        <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Salut Gérant M.G.P. ! Je suis intéressé(e) par l'article de votre boutique : *${product.titre}* au prix de ${product.prix}. Pouvez-vous me donner la procédure ? lien boutique: ${generateShareStr()}`)}" target="_blank" class="btn btn-primary" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; background:#25D366; color:white; border-color:#25D366; width:100%;">
                            💬 Acheter via WhatsApp
                        </a>
                        <button class="btn btn-primary" onclick="openPaymentModal('${product.titre}', '${product.prix}')" style="width:100%;">
                            🛒 Payer par Momo / Carte
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // Gérer les filtres Bouton
    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            const category = filter.getAttribute('data-filter');
            
            if (category === 'all') {
                renderProducts(products);
            } else {
                const filtered = products.filter(p => p.categorie === category);
                renderProducts(filtered);
            }
        });
    });

    // Modale Détails
    const detailsModal = document.getElementById('details-modal');
    window.openProductModal = async (id) => {
        const product = products.find(p => p.id === id);
        if(!product) return;

        // Envoi au serveur SQLite +1 Vue (Au clic)
        await fetch(`${serverURL}/api/products/${id}/view`, { method: 'POST' });

        document.getElementById('modal-title').textContent = product.titre;
        document.getElementById('modal-desc').innerHTML = `
            <div style="text-align:center; margin-bottom:1.5rem;">
                <img src="${serverURL}${product.image_cover}" style="max-height:250px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            </div>
            <strong style="font-size:1.1rem; color:var(--primary);">Description Complète du Gérant :</strong> <br><br> ${product.longDesc}
        `;
        document.getElementById('modal-price').textContent = product.prix;
        detailsModal.classList.add('active');
        
        loadProducts(); // Rafraichissement discret des Vues++ !!!
    };

    document.getElementById('close-details').addEventListener('click', () => {
        detailsModal.classList.remove('active');
    });

    // Modale Paiement
    const paymentModal = document.getElementById('payment-modal');
    window.openPaymentModal = (titre, prix) => {
        document.getElementById('pay-title').textContent = titre;
        document.getElementById('pay-price').textContent = `Total à payer : ${prix}`;
        paymentModal.classList.add('active');
    };

    document.getElementById('close-payment').addEventListener('click', () => {
        paymentModal.classList.remove('active');
        document.getElementById('pay-success').style.display = 'none';
        document.getElementById('payment-form').style.display = 'block';
    });

    // Logique multi-plateformes
    const payMethods = document.querySelectorAll('.pay-method');
    const payDynamicDetails = document.getElementById('pay-dynamic-details');

    payMethods.forEach(method => {
        method.addEventListener('click', () => {
            payMethods.forEach(m => m.classList.remove('active'));
            method.classList.add('active');
            
            const type = method.dataset.method;
            if(type === 'carte') {
                payDynamicDetails.innerHTML = `
                    <label style="margin-top:1rem; display:block; font-weight:bold; font-size:0.9rem;">Numéro de Carte Bancaire</label>
                    <input type="text" placeholder="💳 XXXX XXXX XXXX XXXX" required style="width:100%; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; margin-top:0.3rem;">
                    <div style="display:flex; gap:1rem; margin-top:1rem;">
                        <div style="flex:1;">
                            <label style="font-weight:bold; font-size:0.9rem;">Date Expiration</label>
                            <input type="text" placeholder="MM/YY" required style="width:100%; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; margin-top:0.3rem;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-weight:bold; font-size:0.9rem;">CVC</label>
                            <input type="text" placeholder="123" required style="width:100%; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; margin-top:0.3rem;">
                        </div>
                    </div>
                `;
            } else {
                let prefix = type === 'orange' ? '07' : (type === 'mtn' ? '05' : '01');
                payDynamicDetails.innerHTML = `
                    <label style="margin-top:1rem; display:block; font-weight:bold; font-size:0.9rem;">Numéro Mobile Money (${type.toUpperCase()})</label>
                    <input type="tel" placeholder="Ex: ${prefix} XX XX XX XX" required style="width:100%; padding:0.8rem; border-radius:8px; border:1px solid #cbd5e1; margin-top:0.3rem; font-size:1.1rem; font-family:monospace;">
                    <p style="font-size:0.8rem; color:#64748b; margin-top:0.5rem;">Une demande d'autorisation de retrait vous sera envoyée sur votre compte mobile.</p>
                `;
            }
        });
    });

    document.getElementById('payment-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = document.getElementById('confirm-pay-btn');
        btn.innerHTML = "Traitement Sécurisé avec l'opérateur local... ⏳";
        btn.disabled = true;

        setTimeout(() => {
            document.getElementById('payment-form').style.display = 'none';
            document.getElementById('pay-success').style.display = 'block';
            btn.innerHTML = "Confirmer le paiement 🔒";
            btn.disabled = false;
        }, 2500);
    });

    loadProducts(); // Load DB content Init
});

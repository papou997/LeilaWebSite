document.addEventListener("DOMContentLoaded", () => {
    // 1. Bloquer l'accès aux clients normaux
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'html.html';
        return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== 'admin' && user.email !== 'admin@marcketingguy.com') {
        alert("🔒 Accès Verrouillé. Votre espace Gérant est protégé par mot de passe.");
        window.location.href = 'dashboard.html';
        return;
    }

    const api = 'http://localhost:3000/api';

    // 2. Déconnexion
    document.getElementById('admin-logout').addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('connection_id');
        window.location.href = 'html.html';
    });

    // 3. Navigation Interne des TABS (Sans rechargement de page)
    const links = document.querySelectorAll('.tab-link');
    const sections = document.querySelectorAll('.panel-section');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            links.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(link.dataset.target).classList.add('active');
        });
    });

    // ==========================================
    // MÉTHODES DE CHARGEMENT DE LA BASE (AJAX)
    // ==========================================

    // Charger initialement toutes les données
    loadDashboard();

    // Actualiser uniquement la liste des clients en ligne toutes les 3 secondes !
    setInterval(loadLiveUsers, 3000); 

    // Clients Connectés Actuellement
    async function loadLiveUsers() {
        try {
            const res = await fetch(`${api}/admin/connections/active`);
            const data = await res.json();
            
            const container = document.getElementById('live-container');
            document.getElementById('online-count').innerText = data.active_connections.length;
            document.getElementById('stat-sessions').innerText = data.active_connections.length;
            
            container.innerHTML = "";
            if(data.active_connections.length === 0) {
                container.innerHTML = "<p style='font-size:0.85rem; color:#64748b;'>Personne en boutique.</p>";
            }

            data.active_connections.forEach(c => {
                container.innerHTML += `
                    <div class="live-user-item">
                        <div class="dot"></div>
                        <div style="flex:1;">
                            <div class="live-desc">${c.prenom} ${c.nom}</div>
                            <div class="live-time">${c.device_brand || 'PC'} | ${c.ip_address}</div>
                        </div>
                        <button class="btn-sm btn-danger" style="font-size:0.7rem; padding:0.2rem 0.5rem;" title="Déconnecter à distance de force" onclick="killConnection(${c.connection_id})">Expulser</button>
                    </div>
                `;
            });
        } catch(e) { }
    }

    async function loadDashboard() {
        loadLiveUsers();
        
        try {
            // A. Historique des connexions complet (Log System)
            const connRes = await fetch(`${api}/admin/connections`);
            const connData = await connRes.json();
            const tbodyConn = document.getElementById('admin-recent-connections');
            tbodyConn.innerHTML = "";
            connData.connections.forEach(c => {
                const preciseTime = new Date(c.login_time).toLocaleString('fr-FR');
                tbodyConn.innerHTML += `
                    <tr>
                        <td><strong>${c.prenom} ${c.nom}</strong><br><small style="color:#64748b">${c.email}</small></td>
                        <td><span class="badge bg-blue">${c.ip_address}</span><br><small>${c.country}</small></td>
                        <td>${c.device_type} <br> <small>${c.device_brand}</small></td>
                        <td style="font-weight:600;">${preciseTime}</td>
                    </tr>
                `;
            });

            // B. Lister les catégories existantes pour l'Upload
            const catRes = await fetch(`${api}/categories`);
            const catData = await catRes.json();
            const select = document.getElementById('cat-select');
            select.innerHTML = "";
            catData.categories.forEach(c => select.innerHTML += `<option value="${c.name}">${c.name.toUpperCase()}</option>`);

            // C. Liste Complète des MGP Clients inscrits (Sécurité)
            const userRes = await fetch(`${api}/admin/clients`);
            const userData = await userRes.json();
            document.getElementById('stat-clients').innerText = userData.clients.length;
            const tbodyUsers = document.getElementById('admin-users-list');
            tbodyUsers.innerHTML = "";
            userData.clients.forEach(u => {
                const suspendedStatus = u.is_suspended ? `<span class="badge bg-red">Banni - Suspendu</span>` : `<span class="badge bg-green">Accès Autorisé</span>`;
                const suspendBtn = u.is_suspended 
                    ? `<button class="btn-sm btn-success" title="Enlever bannissement" onclick="toggleSuspend(${u.id}, 0)">🟢 Remettre Accès</button>` 
                    : `<button class="btn-sm btn-danger" title="Suspendre le compte instantanément" onclick="toggleSuspend(${u.id}, 1)">⛔ Suspendre Totalement</button>`;
                
                tbodyUsers.innerHTML += `
                    <tr>
                        <td><strong>${u.nom} ${u.prenom}</strong></td>
                        <td><a href="mailto:${u.email}" style="color:#0284c7;">${u.email}</a></td>
                        <td>${suspendedStatus}</td>
                        <td>${suspendBtn}</td>
                    </tr>
                `;
            });

            // D. Liste des Produits avec Photos réelles UPLOADÉES
            const prodRes = await fetch(`${api}/products`);
            const prodData = await prodRes.json();
            document.getElementById('stat-products').innerText = prodData.products.length;
            const tbodyProd = document.getElementById('admin-products-list');
            tbodyProd.innerHTML = "";
            prodData.products.forEach(p => {
                // Utilisation du chemin réel de l'image (Dossier uploads)
                tbodyProd.innerHTML += `
                    <tr>
                        <td style="color:#94a3b8;">#${p.id}</td>
                        <td><img src="http://localhost:3000${p.image_cover}" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid #cbd5e1;"></td>
                        <td style="font-weight:600;">${p.titre}</td>
                        <td>${p.prix}</td>
                        <td><span class="badge bg-blue" style="text-transform:uppercase;">${p.categorie}</span></td>
                        <td><span class="badge ${p.stock_status.includes('En stock') ? 'bg-green' : 'bg-red'}">${p.stock_status}</span></td>
                        <td style="font-size:1.1rem;">👁️ ${p.vues}</td>
                        <td style="font-size:1.1rem; color:#ef4444;">❤️ ${p.likes}</td>
                    </tr>
                `;
            });

            // E. Téléchargement des Candidatures Dossiers Partenaires
            const appRes = await fetch(`${api}/admin/applications`);
            const appData = await appRes.json();
            const appContainer = document.getElementById('admin-apps-list');
            appContainer.innerHTML = "";
            if(appData.applications.length === 0) {
                appContainer.innerHTML = "<p style='color:#64748b;'>Aucune nouvelle postulation pour devenir livreur.</p>";
            } else {
                appData.applications.forEach(a => {
                    const receivedDate = new Date(a.created_at).toLocaleString('fr-FR');
                    appContainer.innerHTML += `
                        <div style="background:#f8fafc; padding:1.5rem; border:1px solid #cbd5e1; border-radius:12px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                            <div>
                                <h3 style="margin-bottom:0.5rem; color:#0f172a;">💼 Candidat à la livraison: <span style="color:#0284c7;">${a.prenom} ${a.nom}</span></h3>
                                <p style="color:#475569; font-size:0.9rem; margin-bottom:1rem;">📅 Date de naissance: <strong>${a.naissance}</strong> à ${a.lieu} <br> 📍 Adresse/Domicile: <strong>${a.domicile}</strong></p>
                                <p style="font-size:0.8rem; color:#16a34a;">📩 Dossier reçu le : ${receivedDate}</p>
                            </div>
                            <div style="display:flex; gap:1rem; flex-direction:column;">
                                <a href="http://localhost:3000${a.doc_cnib}" target="_blank" class="btn-sm" style="background:#3b82f6; text-decoration:none; text-align:center;">📄 Pièce d'Identité (PDF/PNG)</a>
                                <a href="http://localhost:3000${a.photo_visage}" target="_blank" class="btn-sm" style="background:#6366f1; text-decoration:none; text-align:center;">🤳 Selfie Vérification (JPG)</a>
                            </div>
                        </div>
                    `;
                });
            }

        } catch (e) {
            console.error("Erreur de récupération Serveur...", e);
        }
    }

    // ==========================================
    // GÉRER L'ACTION D'AJOUT PRODUIT (MULTER API)
    // ==========================================
    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-product');
        btn.innerText = "Envoi du fichier Média et Création... ⏳";
        btn.disabled = true;

        // FormData va encrypter l'image et le texte dans le protocole multipart/form-data
        const formData = new FormData(e.target);
        
        try {
            const res = await fetch(`${api}/products`, { method: 'POST', body: formData });
            const data = await res.json();
            if(data.success) {
                alert("🎉 Merveilleux ! Le produit a bien été transfellé sur le serveur et est visible pour les clients en Temps Réel !");
                e.target.reset();
                loadDashboard(); // Actualiser la grille magiquement !
            } else {
                alert("Erreur Refusée: " + data.message);
            }
        } catch(err) {
            console.error(err);
            alert("Erreur serveur lors de la copie du fichier.");
        } finally {
            btn.innerText = "Envoyer au Serveur & Publier";
            btn.disabled = false;
        }
    });

    // ==========================================
    // CREER CATÉGORIE
    // ==========================================
    document.getElementById('btn-add-cat').addEventListener('click', async () => {
        const name = document.getElementById('new-cat-name').value.trim().toLowerCase();
        if(!name) return;
        const res = await fetch(`${api}/admin/categories`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})
        });
        const data = await res.json();
        if(data.success) {
            document.getElementById('new-cat-name').value = "";
            loadDashboard(); // Recharge le menu Select dropdown
        } else alert(data.message);
    });

    // ==========================================
    // FONCTION SUSPENDRE UN CLIENT DEPUIS ADMIN
    // ==========================================
    window.toggleSuspend = async (userId, isSuspended) => {
        if(!confirm(isSuspended ? "DANGER : Ce compte sera TOTALEMENT bloqué. Les sessions actives connectées avec ce compte seront expulsées sur le champ. Continuer ?" : "Souhaitez-vous ré-autoriser cet utilisateur ?")) return;
        
        await fetch(`${api}/admin/users/${userId}/suspend`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({is_suspended: isSuspended})
        });
        loadDashboard(); // Force rafraichissement visuel
    };

    // ==========================================
    // FONCTION DÉCONNECTER UN APPAREIL ACTIF (Tuer connection_id)
    // ==========================================
    window.killConnection = async (connId) => {
        if(!confirm("⚠️ Vous allez expulser cet utilisateur spécifique à distance en coupant ce navigateur/téléphone. Continuer ?")) return;
        
        await fetch(`${api}/admin/connections/${connId}/kill`, { method:'POST' });
        loadLiveUsers(); // Update the sidebar
    };

});

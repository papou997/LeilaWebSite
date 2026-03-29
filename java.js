document.addEventListener("DOMContentLoaded", function() {
    const tabInscription = document.getElementById("tab-inscription");
    const tabConnexion = document.getElementById("tab-connexion");
    
    const formInscription = document.getElementById("form-inscription");
    const formConnexion = document.getElementById("form-connexion");

    if (tabInscription && tabConnexion) {
        // Fonction pour afficher le formulaire d'inscription
        tabInscription.addEventListener("click", function() {
            tabInscription.classList.add("active");
            tabConnexion.classList.remove("active");
            formConnexion.style.display = "none";
            formInscription.style.display = "block";
        });

        // Fonction pour afficher le formulaire de connexion
        tabConnexion.addEventListener("click", function() {
            tabConnexion.classList.add("active");
            tabInscription.classList.remove("active");
            formInscription.style.display = "none";
            formConnexion.style.display = "block";
        });
    }

    if (formInscription) {
        // Appel à l'API pour l'inscription SQLite
        formInscription.addEventListener("submit", async function(e) {
            e.preventDefault(); 
            
            const nom = document.getElementById('nom').value;
            const prenom = document.getElementById('prenom').value;
            const email = document.getElementById('Email').value;
            const mot_de_passe = document.getElementById('mot_de_passe').value;
            
            const radioChoix = document.querySelector('input[name="choix"]:checked');
            const choix = radioChoix ? radioChoix.value : 1;

            try {
                const response = await fetch('http://localhost:3000/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nom, prenom, email, mot_de_passe, choix })
                });
                const data = await response.json();

                if(data.success) {
                    alert("Super ! L'inscription SQLite est un succès. Redirection vers la page de connexion...");
                    if(tabConnexion) tabConnexion.click();
                    formInscription.reset(); 
                } else {
                    alert("Erreur lors de l'inscription : " + data.message);
                }
            } catch (error) {
                alert("\u26A0\uFE0F Impossible de contacter le serveur de base de données.\n\nAssurez-vous d'avoir bien installé Node.js et d'avoir tapé 'npm install' puis 'node server.js' dans le terminal.");
                console.error(error);
            }
        });
    }

    if (formConnexion) {
        // Appel à l'API pour la connexion SQLite
        formConnexion.addEventListener("submit", async function(e) {
            e.preventDefault(); 
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();

                if(data.success) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('connection_id', data.connection_id.toString());
                    
                    alert("Connexion réussie. Ouverture du Dashboard Client !");
                    window.location.href = "dashboard.html";
                } else {
                    alert("\u26A0\uFE0F Erreur : " + data.message);
                }
            } catch (error) {
                alert("\u26A0\uFE0F Impossible de contacter le serveur de base de données.\n\nAssurez-vous que le composant 'node server.js' est bien lancé !");
                console.error(error);
            }
        });
    }

    // Sécurité: Vérifier la session sur Dashboard / Boutique
    const path = window.location.pathname;
    const isProtectedPage = path.includes('dashboard') || path.includes('products') || path.includes('admin');
    
    if (isProtectedPage) {
        const userStr = localStorage.getItem('user');
        const connId = localStorage.getItem('connection_id');
        
        if (!userStr || !connId) {
            alert("🔒 Vous devez être connecté pour accéder à cette fonctionnalité.");
            window.location.href = 'html.html';
        } else {
            // Vérifier auprès du serveur si la session n'a pas été coupée par l'admin (Déconnexion à distance)
            fetch('http://localhost:3000/api/check-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_id: parseInt(connId) })
            })
            .then(res => res.json())
            .then(data => {
                if (!data.active) {
                    localStorage.removeItem('user');
                    localStorage.removeItem('connection_id');
                    alert("⚠️ ALERTE SÉCURITÉ: Cette session a été déconnectée à distance de force ou a expiré.");
                    window.location.href = 'html.html';
                }
            })
            .catch(err => console.error("Erreur check-session :", err));
        }
    }

    // Modification globale du menu en fonction de l'état de connexion Client
    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            
            // Masquer l'onglet "Accueil" ou les liens redirigeant vers l'accueil quand on est connecté
            const navLinks = mainNav.querySelectorAll('li a');
            navLinks.forEach(link => {
                if(link.textContent.trim().toLowerCase() === 'accueil') {
                    link.parentElement.style.display = 'none';
                }
            });
            
            // Si c'est le gérant, afficher Dashboard Gérant
            if(user.role === 'admin' || user.email === 'admin@marcketingguy.com') {
                const adminLi = document.createElement('li');
                adminLi.innerHTML = `<a href="admin_dashboard.html" style="color: #ef4444; font-weight: bold;">⚙️ BACKOFFICE GÉRANT</a>`;
                mainNav.appendChild(adminLi);
            } else {
                // Client normal
                const dashLi = document.createElement('li');
                dashLi.innerHTML = `<a href="dashboard.html" style="font-weight: bold; color: var(--text-main);">🏠 Profil Client</a>`;
                mainNav.appendChild(dashLi);
            }

            // Bouton Boutique Sécurisée accessible à tous les connectés
            const boutiqueLi = document.createElement('li');
            boutiqueLi.innerHTML = `<a href="products.html" style="color: var(--primary); font-weight: bold;">🛍️ Boutique Sécurisée</a>`;
            mainNav.appendChild(boutiqueLi);
            
        } else {
            // Utilisateur déconnecté ou simple visiteur
            const livreurLi = document.createElement('li');
            livreurLi.innerHTML = `<a href="partenaire.html" style="color: #ea580c; font-weight: bold;">🛵 Devenir Livreur Indépendant</a>`;
            mainNav.appendChild(livreurLi);
            // La boutique N'EST PAS insérée.
        }
    }
});

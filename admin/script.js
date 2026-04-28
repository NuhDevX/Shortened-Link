        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, get, set, remove, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
        import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDuZksFmHTAEEB9d8gbHXrEw3AL0W487JQ",
            authDomain: "shortener-link-69e9e.firebaseapp.com",
            databaseURL: "https://shortener-link-69e9e-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "shortener-link-69e9e",
            storageBucket: "shortener-link-69e9e.firebasestorage.app",
            messagingSenderId: "104472108799",
            appId: "1:104472108799:web:dae8f5920c0891b55e36ca"
        };

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);

        let allLinks = [];
        let filteredLinks = [];
        let editingLinkKey = null;
        let originalEditKey = null;

        const domain = window.location.origin + window.location.pathname.replace('admin-pemendek-link.html', 'pemendek-link.html');

        const Utils = {
            showToast(message, type = 'success') {
                const container = document.getElementById('toastContainer');
                const toast = document.createElement('div');
                
                const icons = {
                    success: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
                    error: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
                    warning: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
                    info: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
                };

                const colors = {
                    success: 'from-green-600 to-emerald-600',
                    error: 'from-red-600 to-rose-600',
                    warning: 'from-yellow-600 to-orange-600',
                    info: 'from-blue-600 to-cyan-600'
                };

                toast.className = `toast flex items-center gap-3 bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-lg shadow-2xl min-w-[300px]`;
                toast.innerHTML = `
                    ${icons[type]}
                    <span class="flex-1 font-medium">${message}</span>
                    <button onclick="this.parentElement.remove()" class="hover:bg-white/20 rounded p-1 transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                `;

                container.appendChild(toast);

                setTimeout(() => {
                    toast.classList.add('hide');
                    setTimeout(() => toast.remove(), 300);
                }, 4000);
            },

            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            },

            truncateUrl(url, maxLength = 50) {
                return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
            }
        };

        const Auth = {
            login(email, password) {
                signInWithEmailAndPassword(auth, email, password)
                    .then(() => {
                        Utils.showToast('✅ Login Berhasil! Selamat datang', 'success');
                    })
                    .catch((error) => {
                        console.error('Login error:', error);
                        let errorMessage = '❌ Login Gagal: ';
                        
                        switch(error.code) {
                            case 'auth/invalid-email':
                                errorMessage += 'Email tidak valid';
                                break;
                            case 'auth/user-disabled':
                                errorMessage += 'Akun dinonaktifkan';
                                break;
                            case 'auth/user-not-found':
                                errorMessage += 'Email tidak terdaftar';
                                break;
                            case 'auth/wrong-password':
                                errorMessage += 'Password salah';
                                break;
                            case 'auth/invalid-credential':
                                errorMessage += 'Email atau password salah';
                                break;
                            default:
                                errorMessage += error.message;
                        }
                        
                        Utils.showToast(errorMessage, 'error');
                    });
            },

            logout() {
                signOut(auth)
                    .then(() => {
                        Utils.showToast('👋 Logout berhasil', 'info');
                        document.getElementById('loginEmail').value = '';
                        document.getElementById('loginPassword').value = '';
                    })
                    .catch((error) => {
                        Utils.showToast('❌ Gagal logout: ' + error.message, 'error');
                    });
            },

            init() {
                onAuthStateChanged(auth, (user) => {
                    const loginPage = document.getElementById('loginPage');
                    const dashboard = document.getElementById('adminDashboard');
                    const backButton = document.getElementById('backButton');
                    
                    if (user) {
                        loginPage.style.display = "none";
                        dashboard.style.display = "block";
                        backButton.style.display = "flex";
                        LinksManager.loadLinks();
                    } else {
                        loginPage.style.display = "flex";
                        dashboard.style.display = "none";
                        backButton.style.display = "none";
                    }
                });
            }
        };

        const LinksManager = {
            async loadLinks() {
                const table = document.getElementById('linksTable');
                const loadingState = document.getElementById('loadingState');
                const emptyState = document.getElementById('emptyState');
                
                loadingState.style.display = 'block';
                table.style.display = 'none';
                emptyState.style.display = 'none';
                
                allLinks = [];

                try {
                    const dbRef = ref(db);
                    const snapshot = await get(child(dbRef, 'links'));
                    
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        Object.keys(data).forEach(key => {
                            allLinks.push({
                                key: key,
                                url: data[key]
                            });
                        });
                    }

                    loadingState.style.display = 'none';
                    
                    if (allLinks.length === 0) {
                        emptyState.style.display = 'block';
                    } else {
                        allLinks.sort((a, b) => a.key.localeCompare(b.key));
                        filteredLinks = [...allLinks];
                        table.style.display = 'block';
                        this.render();
                        
                        setTimeout(() => {
                            table.classList.add('show');
                        }, 50);
                    }

                    document.getElementById('totalLinks').textContent = `${allLinks.length} Link`;
                } catch (error) {
                    console.error('Error loading links:', error);
                    loadingState.style.display = 'none';
                    Utils.showToast('❌ Gagal memuat data link', 'error');
                }
            },

            render() {
                const tbody = document.getElementById('linksTableBody');
                
                if (filteredLinks.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="4" class="px-6 py-12 text-center text-purple-300">
                                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                                <p>Tidak ada link yang cocok dengan pencarian</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = filteredLinks.map(link => {
                    const shortUrl = `${domain}?id=${link.key}`;
                    return `
                        <tr class="link-row">
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-2">
                                    <span class="text-white font-mono font-semibold">${Utils.escapeHtml(link.key)}</span>
                                    <button onclick="navigator.clipboard.writeText('${link.key}')" class="text-purple-400 hover:text-purple-300 transition" title="Copy nama">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                        </svg>
                                    </button>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <a href="${shortUrl}" target="_blank" class="text-blue-400 hover:text-blue-300 transition flex items-center gap-2" title="${shortUrl}">
                                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                    </svg>
                                    <span class="font-mono text-sm">${Utils.escapeHtml(Utils.truncateUrl(shortUrl, 40))}</span>
                                </a>
                            </td>
                            <td class="px-6 py-4">
                                <a href="${link.url}" target="_blank" class="text-purple-300 hover:text-purple-200 transition flex items-center gap-2" title="${link.url}">
                                    <span class="text-sm">${Utils.escapeHtml(Utils.truncateUrl(link.url, 50))}</span>
                                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                    </svg>
                                </a>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex items-center justify-center gap-2">
                                    <button data-action="copy" data-url="${shortUrl}" class="bg-blue-600/80 hover:bg-blue-700 text-white p-2 rounded-lg transition" title="Copy link">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                        </svg>
                                    </button>
                                    <button data-action="edit" data-key="${link.key}" data-url="${Utils.escapeHtml(link.url)}" class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-2 rounded-lg transition" title="Edit">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                        </svg>
                                    </button>
                                    <button data-action="delete" data-key="${link.key}" class="bg-red-600/80 hover:bg-red-700 text-white p-2 rounded-lg transition" title="Hapus">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                        </svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');

                tbody.querySelectorAll('[data-action="copy"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        navigator.clipboard.writeText(btn.dataset.url);
                        Utils.showToast('📋 Link berhasil dicopy!', 'success');
                    });
                });

                tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
                    btn.addEventListener('click', () => Modal.openEdit(btn.dataset.key, btn.dataset.url));
                });

                tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
                    btn.addEventListener('click', () => this.deleteLink(btn.dataset.key));
                });
            },

            search(query) {
                const lowerQuery = query.toLowerCase();
                filteredLinks = allLinks.filter(link => 
                    link.key.toLowerCase().includes(lowerQuery) ||
                    link.url.toLowerCase().includes(lowerQuery)
                );
                this.render();
            },

            deleteLink(key) {
                const modal = document.createElement('div');
                modal.className = 'modal active';
                modal.innerHTML = `
                    <div class="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-purple-500/30 max-w-md w-full mx-4" onclick="event.stopPropagation()">
                        <h3 class="text-2xl font-bold text-white mb-4">🗑️ Konfirmasi Hapus</h3>
                        <p class="text-purple-200 mb-2">Apakah Anda yakin ingin menghapus link ini?</p>
                        <div class="bg-purple-900/30 rounded-lg p-3 mb-6 border border-purple-500/30">
                            <p class="text-purple-300 text-sm font-mono break-all"><strong>Nama:</strong> ${Utils.escapeHtml(key)}</p>
                        </div>
                        <p class="text-yellow-300 text-sm mb-6">⚠️ Tindakan ini tidak dapat dibatalkan!</p>
                        <div class="flex gap-3">
                            <button id="cancelDeleteBtn" class="flex-1 bg-gray-600/80 hover:bg-gray-700 text-white py-3 rounded-lg transition">
                                Batal
                            </button>
                            <button id="confirmDeleteBtn" class="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white py-3 rounded-lg transition font-semibold">
                                Hapus
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                modal.querySelector('#cancelDeleteBtn').onclick = () => modal.remove();
                modal.querySelector('#confirmDeleteBtn').onclick = async () => {
                    try {
                        await remove(ref(db, `links/${key}`));
                        modal.remove();
                        this.loadLinks();
                        Utils.showToast('✅ Link berhasil dihapus!', 'success');
                    } catch (error) {
                        console.error('Error:', error);
                        Utils.showToast('❌ Gagal menghapus link', 'error');
                    }
                };
            }
        };

                const Modal = {
            openEdit(key, url) {
                editingLinkKey = key;
                originalEditKey = key;

                document.getElementById('editDomainPrefix').textContent = domain + '?id=';
                document.getElementById('editCustomName').value = key;
                document.getElementById('editOriginalUrl').value = url;
                
                this.hideEditError();
                document.getElementById('editModal').classList.add('active');
            },

            closeEdit() {
                document.getElementById('editModal').classList.remove('active');
                editingLinkKey = null;
                originalEditKey = null;
            },

            showEditError(message) {
                const errorDiv = document.getElementById('editErrorMsg');
                const errorText = document.getElementById('editErrorText');
                errorText.textContent = message;
                errorDiv.classList.remove('hidden');
            },

            hideEditError() {
                document.getElementById('editErrorMsg').classList.add('hidden');
            },

            async saveEdit() {
                const newKey = document.getElementById('editCustomName').value.trim();
                const newUrl = document.getElementById('editOriginalUrl').value.trim();

                this.hideEditError();

                if (!newKey || !newUrl) {
                    this.showEditError('Semua field harus diisi!');
                    return;
                }

                if (!/^[a-zA-Z0-9-_]+$/.test(newKey)) {
                    this.showEditError('Nama custom hanya boleh berisi huruf, angka, dash (-) dan underscore (_)');
                    return;
                }

                const normalizedUrl = newUrl.startsWith('http') ? newUrl : 'https://' + newUrl;

                try {
                    if (newKey !== originalEditKey) {
                        const dbRef = ref(db);
                        const snapshot = await get(child(dbRef, `links/${newKey}`));
                        
                        if (snapshot.exists()) {
                            this.showEditError(`Nama link "${newKey}" sudah digunakan!`);
                            return;
                        }

                        await remove(ref(db, `links/${originalEditKey}`));
                    }

                    await set(ref(db, `links/${newKey}`), normalizedUrl);

                    this.closeEdit();
                    LinksManager.loadLinks();
                    Utils.showToast('✅ Link berhasil diupdate!', 'success');
                } catch (error) {
                    console.error('Error:', error);
                    this.showEditError('Gagal menyimpan perubahan: ' + error.message);
                }
            }
        };

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            Auth.login(email, password);
        });

        document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
        document.getElementById('searchInput').addEventListener('input', (e) => {
            LinksManager.search(e.target.value);
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            LinksManager.loadLinks();
            Utils.showToast('🔄 Data telah direfresh', 'info');
        });

        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') Modal.closeEdit();
        });
        document.getElementById('closeEditBtn').addEventListener('click', () => Modal.closeEdit());
        document.getElementById('cancelEditBtn').addEventListener('click', () => Modal.closeEdit());
        document.getElementById('saveEditBtn').addEventListener('click', () => Modal.saveEdit());
        document.getElementById('editCustomName').addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9-_]/g, '');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Modal.closeEdit();
            }
        });
        Auth.init();

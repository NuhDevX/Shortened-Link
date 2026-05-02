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
        let countdownIntervals = {};

        const domain = "https://s.nuhweb.site";
        const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
                div.textContent = String(text || '');
                return div.innerHTML;
            },

            truncateUrl(url, maxLength = 50) {
                return url && url.length > maxLength ? url.substring(0, maxLength) + '...' : (url || '');
            },

            normalizeLink(key, data) {
                if (typeof data === 'string') {
                    return {
                        key,
                        url: data,
                        createdAt: null,
                        expiresAt: null,
                        status: 'active', 
                        isLegacy: true
                    };
                }
                return {
                    key,
                    url: data.url || '',
                    createdAt: data.createdAt || null,
                    expiresAt: data.expiresAt || null,
                    status: data.status || 'active',
                    expiredAt: data.expiredAt || null,
                    deletedAt: data.deletedAt || null,
                    isLegacy: false
                };
            },

            formatCountdown(msLeft) {
                if (msLeft <= 0) return { simple: '0 jam lagi', detail: '0 jam 0 detik' };
                const totalSec = Math.floor(msLeft / 1000);
                const days = Math.floor(totalSec / 86400);
                const hours = Math.floor((totalSec % 86400) / 3600);
                const mins = Math.floor((totalSec % 3600) / 60);
                const secs = totalSec % 60;

                let simple, detail;
                if (days >= 1) {
                    simple = `${days} hari lagi`;
                    detail = `${days} hari ${hours} jam ${secs} detik`;
                } else {
                    simple = `${hours} jam lagi`;
                    detail = `${hours} jam ${mins} menit ${secs} detik`;
                }
                return { simple, detail, days, hours, mins, secs };
            }
        };

        function clearAllCountdowns() {
            Object.values(countdownIntervals).forEach(id => clearInterval(id));
            countdownIntervals = {};
        }

        function startCountdown(key, targetMs, simpleId, detailId) {
            if (countdownIntervals[key]) clearInterval(countdownIntervals[key]);

            function update() {
                const now = Date.now();
                const left = targetMs - now;
                const simpleEl = document.getElementById(simpleId);
                const detailEl = document.getElementById(detailId);
                if (!simpleEl || !detailEl) {
                    clearInterval(countdownIntervals[key]);
                    return;
                }
                if (left <= 0) {
                    simpleEl.textContent = 'Kadaluarsa';
                    detailEl.textContent = 'Kadaluarsa';
                    clearInterval(countdownIntervals[key]);
                    setTimeout(() => LinksManager.loadLinks(), 2000);
                    return;
                }
                const f = Utils.formatCountdown(left);
                simpleEl.textContent = f.simple;
                detailEl.textContent = f.detail;
            }
            update();
            countdownIntervals[key] = setInterval(update, 1000);
        }

        async function processAutoExpireDelete(links) {
            const now = Date.now();
            const updates = [];

            for (const link of links) {
                if (link.isLegacy) continue;

                if (link.status === 'active' && link.expiresAt && now > link.expiresAt) {
                    const deletedAt = now + SEVEN_DAYS_MS;
                    updates.push(set(ref(db, `links/${link.key}`), {
                        url: link.url,
                        createdAt: link.createdAt,
                        expiresAt: link.expiresAt,
                        status: 'expired',
                        expiredAt: now,
                        deletedAt: deletedAt
                    }));
                    link.status = 'expired';
                    link.expiredAt = now;
                    link.deletedAt = deletedAt;
                }

                if (link.status === 'expired' && link.deletedAt && now > link.deletedAt) {
                    updates.push(remove(ref(db, `links/${link.key}`)));
                    link._pendingDelete = true;
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates).catch(e => console.error('Auto-process error:', e));
            }
        }

        const Auth = {
            login(email, password) {
                signInWithEmailAndPassword(auth, email, password)
                    .then(() => Utils.showToast('✅ Login Berhasil! Selamat datang', 'success'))
                    .catch((error) => {
                        let msg = '❌ Login Gagal: ';
                        switch(error.code) {
                            case 'auth/invalid-email': msg += 'Email tidak valid'; break;
                            case 'auth/user-disabled': msg += 'Akun dinonaktifkan'; break;
                            case 'auth/user-not-found': msg += 'Email tidak terdaftar'; break;
                            case 'auth/wrong-password': msg += 'Password salah'; break;
                            case 'auth/invalid-credential': msg += 'Email atau password salah'; break;
                            default: msg += error.message;
                        }
                        Utils.showToast(msg, 'error');
                    });
            },

            logout() {
                signOut(auth)
                    .then(() => {
                        Utils.showToast('👋 Logout berhasil', 'info');
                        document.getElementById('loginEmail').value = '';
                        document.getElementById('loginPassword').value = '';
                    })
                    .catch((error) => Utils.showToast('❌ Gagal logout: ' + error.message, 'error'));
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
                        clearAllCountdowns();
                    }
                });
            }
        };

        const LinksManager = {
            async loadLinks() {
                clearAllCountdowns();
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
                            const normalized = Utils.normalizeLink(key, data[key]);
                            allLinks.push(normalized);
                        });
                    }

                    await processAutoExpireDelete(allLinks);
                    allLinks = allLinks.filter(l => !l._pendingDelete);

                    loadingState.style.display = 'none';

                    const activeLinks = allLinks.filter(l => l.status === 'active');
                    const expiredLinks = allLinks.filter(l => l.status === 'expired');

                    document.getElementById('totalLinks').textContent = `${allLinks.length} Link`;
                    document.getElementById('activeCount').textContent = `${activeLinks.length} Aktif`;
                    document.getElementById('expiredCount').textContent = `${expiredLinks.length} Kadaluarsa`;

                    if (allLinks.length === 0) {
                        emptyState.style.display = 'block';
                    } else {
                        allLinks.sort((a, b) => {
                            if (a.status === b.status) {
                                return (b.createdAt || 0) - (a.createdAt || 0);
                            }
                            return a.status === 'active' ? -1 : 1;
                        });
                        filteredLinks = [...allLinks];
                        table.style.display = 'block';
                        this.render();
                        setTimeout(() => table.classList.add('show'), 50);
                    }
                } catch (error) {
                    console.error('Error loading links:', error);
                    loadingState.style.display = 'none';
                    Utils.showToast('❌ Gagal memuat data link', 'error');
                }
            },

            render() {
                clearAllCountdowns();
                const tbody = document.getElementById('linksTableBody');

                if (filteredLinks.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-6 py-12 text-center text-purple-300">
                                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                                <p>Tidak ada link yang cocok dengan pencarian</p>
                            </td>
                        </tr>
                    `;
                    return;
                }

                const now = Date.now();

                tbody.innerHTML = filteredLinks.map(link => {
                    const shortUrl = `${domain}?id=${link.key}`;
                    const isActive = link.status === 'active';
                    const isLegacy = link.isLegacy;

                    let statusBadge = '';
                    if (isLegacy) {
                        statusBadge = `<span class="inline-flex items-center gap-1 bg-green-600/30 text-green-300 border border-green-500/40 px-2 py-0.5 rounded-full text-xs font-semibold">
                            <span class="w-1.5 h-1.5 bg-green-400 rounded-full"></span>Aktif</span>`;
                    } else if (isActive) {
                        statusBadge = `<span class="inline-flex items-center gap-1 bg-green-600/30 text-green-300 border border-green-500/40 px-2 py-0.5 rounded-full text-xs font-semibold">
                            <span class="w-1.5 h-1.5 bg-green-400 rounded-full"></span>Aktif</span>`;
                    } else {
                        statusBadge = `<span class="inline-flex items-center gap-1 bg-red-600/30 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full text-xs font-semibold">
                            <span class="w-1.5 h-1.5 bg-red-400 rounded-full"></span>Nonaktif</span>`;
                    }

                    const simpleId = `simple-${link.key}`;
                    const detailId = `detail-${link.key}`;
                    const toggleId = `toggle-${link.key}`;
                    let countdownSection = '';

                    if (isLegacy) {
                        countdownSection = `<div class="text-xs text-purple-400 mt-1">Link lama (tanpa kadaluarsa)</div>`;
                    } else if (isActive && link.expiresAt) {
                        const msLeft = link.expiresAt - now;
                        const f = Utils.formatCountdown(msLeft > 0 ? msLeft : 0);
                        countdownSection = `
                            <div class="mt-1 text-xs text-yellow-300">
                                <span class="text-purple-300">Kadaluarsa:</span>
                                <span id="${simpleId}" class="countdown-simple font-semibold">${f.simple}</span>
                                <span id="${detailId}" class="countdown-detail text-yellow-200 font-semibold">${f.detail}</span>
                                <button id="${toggleId}" onclick="toggleCountdown('${link.key}')" class="ml-1 underline text-blue-400 hover:text-blue-300 cursor-pointer">lihat detail</button>
                            </div>`;
                    } else if (!isActive && link.deletedAt) {
                        const msLeft = link.deletedAt - now;
                        const f = Utils.formatCountdown(msLeft > 0 ? msLeft : 0);
                        countdownSection = `
                            <div class="mt-1 text-xs text-red-300">
                                <span class="text-purple-300">Dihapus dalam:</span>
                                <span id="${simpleId}" class="countdown-simple font-semibold">${f.simple}</span>
                                <span id="${detailId}" class="countdown-detail text-red-200 font-semibold">${f.detail}</span>
                                <button id="${toggleId}" onclick="toggleCountdown('${link.key}')" class="ml-1 underline text-blue-400 hover:text-blue-300 cursor-pointer">lihat detail</button>
                            </div>`;
                    }

                    let actionButtons = '';
                    if (isActive || isLegacy) {
                        actionButtons = `
                            <button data-action="copy" data-url="${shortUrl}" class="bg-blue-600/80 hover:bg-blue-700 text-white p-2 rounded-lg transition" title="Copy link">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <button data-action="edit" data-key="${link.key}" data-url="${Utils.escapeHtml(link.url)}" class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-2 rounded-lg transition" title="Edit">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button data-action="delete" data-key="${link.key}" class="bg-red-600/80 hover:bg-red-700 text-white p-2 rounded-lg transition" title="Hapus">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>`;
                    } else {
                        actionButtons = `
                            <button data-action="renew" data-key="${link.key}" class="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-2 rounded-lg transition text-xs font-semibold flex items-center gap-1" title="Perbarui link (perpanjang 1 bulan)">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                Perbarui
                            </button>
                            <button data-action="delete" data-key="${link.key}" class="bg-red-600/80 hover:bg-red-700 text-white p-2 rounded-lg transition" title="Hapus sekarang">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>`;
                    }

                    return `
                        <tr class="link-row ${!isActive && !isLegacy ? 'opacity-70' : ''}">
                            <td class="px-4 py-4">
                                <div class="flex items-center gap-2">
                                    <span class="text-white font-mono font-semibold text-sm">${Utils.escapeHtml(link.key)}</span>
                                    <button onclick="navigator.clipboard.writeText('${link.key}')" class="text-purple-400 hover:text-purple-300 transition" title="Copy nama">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                    </button>
                                </div>
                            </td>
                            <td class="px-4 py-4">
                                <a href="${shortUrl}" target="_blank" class="text-blue-400 hover:text-blue-300 transition flex items-center gap-1 text-sm" title="${shortUrl}">
                                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                    <span class="font-mono">${Utils.escapeHtml(Utils.truncateUrl(shortUrl, 35))}</span>
                                </a>
                            </td>
                            <td class="px-4 py-4">
                                <a href="${link.url}" target="_blank" class="text-purple-300 hover:text-purple-200 transition flex items-center gap-1 text-sm" title="${link.url}">
                                    <span>${Utils.escapeHtml(Utils.truncateUrl(link.url, 40))}</span>
                                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                            </td>
                            <td class="px-4 py-4">
                                <div class="flex flex-col items-start gap-1">
                                    ${statusBadge}
                                    ${countdownSection}
                                </div>
                            </td>
                            <td class="px-4 py-4">
                                <div class="flex items-center justify-center gap-2 flex-wrap">
                                    ${actionButtons}
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
                tbody.querySelectorAll('[data-action="renew"]').forEach(btn => {
                    btn.addEventListener('click', () => this.renewLink(btn.dataset.key));
                });

                filteredLinks.forEach(link => {
                    if (link.isLegacy) return;
                    const simpleId = `simple-${link.key}`;
                    const detailId = `detail-${link.key}`;
                    if (link.status === 'active' && link.expiresAt) {
                        startCountdown(link.key, link.expiresAt, simpleId, detailId);
                    } else if (link.status === 'expired' && link.deletedAt) {
                        startCountdown(`del-${link.key}`, link.deletedAt, simpleId, detailId);
                    }
                });
            },

            search(query, statusFilter = 'all') {
                const lowerQuery = query.toLowerCase();
                filteredLinks = allLinks.filter(link => {
                    const matchQuery = link.key.toLowerCase().includes(lowerQuery) ||
                                      (link.url || '').toLowerCase().includes(lowerQuery);
                    const matchStatus = statusFilter === 'all' || link.status === statusFilter;
                    return matchQuery && matchStatus;
                });
                this.render();
            },

            async renewLink(key) {
                const link = allLinks.find(l => l.key === key);
                if (!link) return;

                const now = Date.now();
                const newExpiresAt = now + ONE_MONTH_MS;

                try {
                    await set(ref(db, `links/${key}`), {
                        url: link.url,
                        createdAt: link.createdAt || now,
                        expiresAt: newExpiresAt,
                        status: 'active'
                    });
                    Utils.showToast('✅ Link berhasil diperbarui! Aktif kembali selama 30 hari.', 'success');
                    this.loadLinks();
                } catch (error) {
                    console.error('Renew error:', error);
                    Utils.showToast('❌ Gagal memperbarui link', 'error');
                }
            },

            deleteLink(key) {
                const modal = document.createElement('div');
                modal.className = 'modal active';
                modal.innerHTML = `
                    <div class="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-purple-500/30 max-w-md w-full mx-4" onclick="event.stopPropagation()">
                        <h3 class="text-2xl font-bold text-white mb-4">🗑️ Konfirmasi Hapus</h3>
                        <p class="next-door pre-order for the day mb-2">Apakah Anda yakin ingin menghapus link ini?</p>
                        <div class="bg-purple-900/30 rounded-lg p-3 mb-6 border border-purple-500/30">
                            <p class="text-purple-300 text-sm font-mono break-all"><strong>Nama:</strong> ${Utils.escapeHtml(key)}</p>
                        </div>
                        <p class="text-yellow-300 text-sm mb-6">⚠️ Tindakan ini tidak dapat dibatalkan!</p>
                        <div class="flex gap-3">
                            <button id="cancelDeleteBtn" class="flex-1 bg-gray-600/80 hover:bg-gray-700 text-white py-3 rounded-lg transition">Batal</button>
                            <button id="confirmDeleteBtn" class="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white py-3 rounded-lg transition font-semibold">Hapus</button>
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

        window.toggleCountdown = function(key) {
            const simpleEl = document.getElementById(`simple-${key}`);
            const detailEl = document.getElementById(`detail-${key}`);
            const toggleBtn = document.getElementById(`toggle-${key}`);
            if (!simpleEl || !detailEl) return;

            const isDetailed = detailEl.classList.contains('show');
            if (isDetailed) {
                detailEl.classList.remove('show');
                simpleEl.classList.remove('hide');
                if (toggleBtn) toggleBtn.textContent = 'lihat detail';
            } else {
                detailEl.classList.add('show');
                simpleEl.classList.add('hide');
                if (toggleBtn) toggleBtn.textContent = 'sembunyikan';
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
                document.getElementById('editErrorText').textContent = message;
                document.getElementById('editErrorMsg').classList.remove('hidden');
            },

            hideEditError() {
                document.getElementById('editErrorMsg').classList.add('hidden');
            },

            async saveEdit() {
                const newKey = document.getElementById('editCustomName').value.trim();
                const newUrl = document.getElementById('editOriginalUrl').value.trim();
                this.hideEditError();

                if (!newKey || !newUrl) { this.showEditError('Semua field harus diisi!'); return; }
                if (!/^[a-zA-Z0-9-_]+$/.test(newKey)) { this.showEditError('Nama custom hanya boleh berisi huruf, angka, dash (-) dan underscore (_)'); return; }

                let normalizedUrl = newUrl;
                if (!newUrl.startsWith('http')) normalizedUrl = 'https://' + newUrl;

                try {
                    const currentLink = allLinks.find(l => l.key === originalEditKey);
                    const currentData = currentLink && !currentLink.isLegacy ? {
                        url: currentLink.url,
                        createdAt: currentLink.createdAt,
                        expiresAt: currentLink.expiresAt,
                        status: currentLink.status,
                        expiredAt: currentLink.expiredAt,
                        deletedAt: currentLink.deletedAt
                    } : null;

                    if (newKey !== originalEditKey) {
                        const snapshot = await get(child(ref(db), `links/${newKey}`));
                        if (snapshot.exists()) { this.showEditError(`Nama "${newKey}" sudah digunakan!`); return; }
                        // Save new key
                        if (currentData) {
                            await set(ref(db, `links/${newKey}`), { ...currentData, url: normalizedUrl });
                        } else {
                            await set(ref(db, `links/${newKey}`), normalizedUrl);
                        }
                        await remove(ref(db, `links/${originalEditKey}`));
                    } else {
                        if (currentData) {
                            await set(ref(db, `links/${newKey}`), { ...currentData, url: normalizedUrl });
                        } else {
                            await set(ref(db, `links/${newKey}`), normalizedUrl);
                        }
                    }

                    this.closeEdit();
                    LinksManager.loadLinks();
                    Utils.showToast('✅ Link berhasil diperbarui!', 'success');
                } catch (error) {
                    console.error('Edit error:', error);
                    this.showEditError('Gagal menyimpan perubahan. Coba lagi.');
                }
            }
        };

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            Auth.login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        });

        document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
        document.getElementById('refreshBtn').addEventListener('click', () => LinksManager.loadLinks());

        document.getElementById('searchInput').addEventListener('input', (e) => {
            const statusFilter = document.getElementById('filterStatus').value;
            LinksManager.search(e.target.value, statusFilter);
        });

        document.getElementById('filterStatus').addEventListener('change', (e) => {
            const query = document.getElementById('searchInput').value;
            LinksManager.search(query, e.target.value);
        });

        document.getElementById('closeEditBtn').addEventListener('click', () => Modal.closeEdit());
        document.getElementById('cancelEditBtn').addEventListener('click', () => Modal.closeEdit());
        document.getElementById('saveEditBtn').addEventListener('click', () => Modal.saveEdit());

        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('editModal')) Modal.closeEdit();
        });

        document.getElementById('editCustomName').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9-_]/g, '');
        });

        Auth.init();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getDatabase, ref, set, get, remove, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

    const domain = "https://s.nuhweb.site";
    document.getElementById('domainPrefix').textContent = domain + '?id=';

    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    function showError(message) {
        const errorDiv = document.getElementById('errorMsg');
        document.getElementById('errorText').textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => errorDiv.classList.add('hidden'), 5000);
    }

    function hideError() {
        document.getElementById('errorMsg').classList.add('hidden');
    }

    function isValidUrl(url) {
        try {
            const normalized = url.startsWith('http') ? url : 'https://' + url;
            const parsed = new URL(normalized);
            return (parsed.protocol === 'http:' || parsed.protocol === 'https:') 
                   && parsed.hostname.includes('.');
        } catch {
            return false;
        }
    }

    async function checkRedirect() {
        const urlParams = new URLSearchParams(window.location.search);
        const shortId = urlParams.get('id');

        if (!shortId) return;

        const overlay = document.getElementById('redirectOverlay');
        overlay.classList.add('visible');

        const dbRef = ref(db);
        try {
            const snapshot = await get(child(dbRef, `links/${shortId}`));
            if (snapshot.exists()) {
                const data = snapshot.val();

                let linkData;
                if (typeof data === 'string') {
                    linkData = { url: data, createdAt: Date.now(), status: 'active' };
                } else {
                    linkData = data;
                }

                const now = Date.now();
                const createdAt = linkData.createdAt || now;
                const expiresAt = linkData.expiresAt || (createdAt + ONE_MONTH_MS);
                const status = linkData.status || 'active';

                if (status === 'expired' || now > expiresAt) {
                    if (status !== 'expired') {
                        const deletedAt = now + SEVEN_DAYS_MS;
                        await set(ref(db, `links/${shortId}`), {
                            ...linkData,
                            status: 'expired',
                            expiredAt: now,
                            deletedAt: deletedAt
                        });
                    }
                    overlay.classList.remove('visible');
                    showExpiredPage();
                    return;
                }

                setTimeout(() => {
                    window.location.href = linkData.url;
                }, 800);
            } else {
                overlay.classList.remove('visible');
                showExpiredPage();
            }
        } catch (error) {
            console.error(error);
            overlay.classList.remove('visible');
            showError("Terjadi kesalahan saat mengakses link.");
        }
    }

    function showExpiredPage() {
        document.getElementById('expiredPage').classList.add('visible');
        document.querySelector('.flex.items-center.justify-center.min-h-screen').style.display = 'none';
        document.querySelector('.back-button').style.display = 'none';
    }

    document.getElementById('generateBtn').addEventListener('click', async function() {
        const originalUrl = document.getElementById('originalUrl').value.trim();
        const customName = document.getElementById('customName').value.trim();

        hideError();

        if (!originalUrl || !customName) {
            showError('Isi semua kolom!');
            return;
        }

        if (!isValidUrl(originalUrl)) {
           showError('URL tidak valid! Contoh: google.com atau https://example.com');
            return;
        }
        
        const normalizedUrl = originalUrl.startsWith('http') ? originalUrl : 'https://' + originalUrl;

        document.getElementById('generateBtn').disabled = true;
        document.getElementById('loadingDiv').classList.remove('hidden');

        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `links/${customName}`));

            if (snapshot.exists()) {
                showError(`Nama link "${customName}" itu sudah pernah dipendekkan`);
                document.getElementById('loadingDiv').classList.add('hidden');
                document.getElementById('generateBtn').disabled = false;
                return;
            }

            const now = Date.now();
            const expiresAt = now + ONE_MONTH_MS;

            await set(ref(db, 'links/' + customName), {
                url: normalizedUrl,
                createdAt: now,
                expiresAt: expiresAt,
                status: 'active'
            });

            const shortenedUrl = `${domain}?id=${customName}`;
            document.getElementById('shortenedLink').href = shortenedUrl;
            document.getElementById('shortenedLink').textContent = shortenedUrl;
            document.getElementById('expiryInfo').textContent = '30 hari';

            document.getElementById('loadingDiv').classList.add('hidden');
            document.getElementById('resultDiv').classList.remove('hidden');
        } catch (e) {
            console.error(e);
            showError("Gagal menyimpan ke database. Silakan coba lagi.");
            document.getElementById('loadingDiv').classList.add('hidden');
        } finally {
            document.getElementById('generateBtn').disabled = false;
        }
    });

    document.getElementById('copyBtn').addEventListener('click', function() {
        const link = document.getElementById('shortenedLink').textContent;
        navigator.clipboard.writeText(link);
        document.getElementById('copyIcon').classList.add('hidden');
        document.getElementById('checkIcon').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('copyIcon').classList.remove('hidden');
            document.getElementById('checkIcon').classList.add('hidden');
        }, 2000);
    });

    document.getElementById('resetBtn').addEventListener('click', function() {
        document.getElementById('originalUrl').value = '';
        document.getElementById('customName').value = '';
        document.getElementById('resultDiv').classList.add('hidden');
        hideError();
    });

    document.getElementById('customName').addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/[^a-zA-Z0-9-_]/g, '');
    });

    const starsContainer = document.getElementById('stars');
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        starsContainer.appendChild(star);
    }

    checkRedirect();

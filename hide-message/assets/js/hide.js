function initHideTab() {
    const uploadBtn = document.getElementById('upload-btn');
    const removeBtn = document.getElementById('remove-btn');
    const imageInput = document.getElementById('image-upload');

    const uploadedImageGroup = document.getElementById('uploaded-image-group');
    const preview = document.getElementById('image-preview');
    const description = document.getElementById('image-description');
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('message-char-count');

    uploadBtn.addEventListener('click', function () {
        imageInput.click();
    });

    removeBtn.addEventListener('click', function () {
        resetHideForm();
    });

    imageInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file && file.type.startsWith('image/')) {
            uploadedImageGroup.style.display = '';
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;

                const img = new window.Image();
                img.onload = function () {
                    description.textContent = `Resolution: ${img.naturalWidth} x ${img.naturalHeight}`;
                    const totalPixels = img.naturalWidth * img.naturalHeight;
                    const totalLSBBits = totalPixels * 3;
                    const safetyMargin = 8;
                    const maxBytes = Math.floor(totalLSBBits / 8) - safetyMargin;

                    function getMaxPlaintextLength(maxBytes) {
                        for (let M = maxBytes - 44; M > 0; M--) {
                            const total = M + 44;
                            const base64Len = Math.ceil(total / 3) * 4;
                            if (base64Len <= maxBytes) return M;
                        }
                        return 0;
                    }

                    const maxChars = getMaxPlaintextLength(maxBytes);
                    description.textContent += ` | Max message size: ${maxChars} characters`;

                    if (messageInput && charCount) {
                        messageInput.maxLength = maxChars;
                        charCount.textContent = `${messageInput.value.length}/${maxChars}`;
                        messageInput.addEventListener('input', function () {
                            charCount.textContent = `${messageInput.value.length}/${maxChars}`;
                        });
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    const hideMessageBtn = document.getElementById('hide-message-btn');

    hideMessageBtn.addEventListener('click', async function () {
        const message = messageInput.value;
        const password = document.getElementById('password-input').value;
        if (!message || !password) {
            console.error('Message and password are required.');
            return;
        }

        async function encryptMessage(message, password) {
            const enc = new TextEncoder();
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
            );
            const key = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt']
            );
            const ciphertext = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                enc.encode(message)
            );

            const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

            return btoa(String.fromCharCode(...combined));
        }
        try {
            const encrypted = await encryptMessage(message, password);

            const imgTag = preview.querySelector('img');
            if (!imgTag) {
                console.error('No image loaded for embedding.');
                return;
            }
            const tempImg = new window.Image();
            tempImg.crossOrigin = 'Anonymous';
            tempImg.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = tempImg.naturalWidth;
                canvas.height = tempImg.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempImg, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                function toBinary(str) {
                    return str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
                }
                const binMsg = toBinary(encrypted);
                const msgLen = binMsg.length;
                const lenBin = msgLen.toString(2).padStart(32, '0');
                const lenBytes = new Uint8Array(4);
                lenBytes[0] = (msgLen >>> 24) & 0xFF;
                lenBytes[1] = (msgLen >>> 16) & 0xFF;
                lenBytes[2] = (msgLen >>> 8) & 0xFF;
                lenBytes[3] = msgLen & 0xFF;
                let lenBinBE = '';
                for (let i = 0; i < 4; i++) {
                    lenBinBE += lenBytes[i].toString(2).padStart(8, '0');
                }

                const fullBin = lenBinBE + binMsg;
                if (fullBin.length > data.length / 4 * 3) {
                    console.error('Message too large to embed in image.');
                    return;
                }

                for (let i = 0; i < data.length; i++) {
                    if ((i % 4) !== 3) {
                        data[i] = data[i] & 0xFE;
                    }
                }

                let dataIdx = 0;
                for (let i = 0; i < lenBinBE.length;) {
                    if ((dataIdx % 4) !== 3) {
                        data[dataIdx] = (data[dataIdx] & 0xFE) | parseInt(lenBinBE[i], 10);
                        i++;
                    }
                    dataIdx++;
                }
                for (let i = 0; i < binMsg.length;) {
                    if ((dataIdx % 4) !== 3) {
                        data[dataIdx] = (data[dataIdx] & 0xFE) | parseInt(binMsg[i], 10);
                        i++;
                    }
                    dataIdx++;
                }
                ctx.putImageData(imageData, 0, 0);

                // After encoding, log the first 50 LSB bits of the image
                let lsbBits = '';
                for (let i = 0, count = 0; i < data.length && count < 50; i++) {
                    if ((i % 4) !== 3) {
                        lsbBits += (data[i] & 1).toString();
                        count++;
                    }
                }
                console.log('First 50 LSB bits after encoding:', lsbBits);

                const stegoDataUrl = canvas.toDataURL('image/png');

                let originalName = imageInput.files && imageInput.files[0] && imageInput.files[0].name ? imageInput.files[0].name : 'image';
                let baseName = originalName.replace(/\.[^.]+$/, '');
                const a = document.createElement('a');
                a.href = stegoDataUrl;
                a.download = baseName + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
            tempImg.src = imgTag.src;
        } catch (e) {
            console.error('Encryption failed:', e);
        }
    });
}

function resetHideForm() {
    const imageInput = document.getElementById('image-upload');
    const preview = document.getElementById('image-preview');
    const description = document.getElementById('image-description');
    const messageInput = document.getElementById('message-input');
    const charCount = document.getElementById('message-char-count');
    const passwordInput = document.getElementById('password-input');
    const uploadedImageGroup = document.getElementById('uploaded-image-group');

    imageInput.value = '';
    preview.innerHTML = '';
    description.textContent = '';
    messageInput.value = '';
    charCount.textContent = '0';
    passwordInput.value = '';
    uploadedImageGroup.style.display = 'none';
}

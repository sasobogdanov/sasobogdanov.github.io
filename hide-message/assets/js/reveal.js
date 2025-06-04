function initRevealTab() {
    const uploadBtn = document.getElementById('upload-btn');
    const removeBtn = document.getElementById('remove-btn');
    const imageInput = document.getElementById('image-upload');

    const uploadedImageGroup = document.getElementById('uploaded-image-group');
    const preview = document.getElementById('image-preview');
    const description = document.getElementById('image-description');
    const revealedMessageDiv = document.getElementById('revealed-message');

    uploadBtn.addEventListener('click', function () {
        imageInput.click();
    });

    removeBtn.addEventListener('click', function () {
        resetHideForm();
    });

    imageInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file && file.type.startsWith('image/')) {
            if (uploadedImageGroup) uploadedImageGroup.style.display = '';
            if (revealedMessageDiv) revealedMessageDiv.style.display = 'none';

            const reader = new FileReader();
            reader.onload = function (e) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;

                const img = new window.Image();
                img.onload = function () {
                    description.textContent = `Resolution: ${img.naturalWidth} x ${img.naturalHeight}`;
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    const revealMessageBtn = document.getElementById('reveal-message-btn');

    revealMessageBtn.addEventListener('click', async function () {
        if (!preview.querySelector('img')) {
            revealedMessageDiv.style.display = '';
            revealedMessageDiv.textContent = 'No image loaded.';
            return;
        }
        const password = document.getElementById('password-input').value;
        if (!password) {
            revealedMessageDiv.style.display = '';
            revealedMessageDiv.textContent = 'Password is required.';
            return;
        }

        const imgTag = preview.querySelector('img');
        const tempImg = new window.Image();
        tempImg.crossOrigin = 'Anonymous';
        tempImg.onload = async function () {
            const canvas = document.createElement('canvas');
            canvas.width = tempImg.naturalWidth;
            canvas.height = tempImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const lsbBits = extractLSBBits(data);
            console.log('First 50 LSB bits after reading:', lsbBits.slice(0, 50));

            // Defensive: try to decode as much as possible, but don't loop forever
            let maxBytes = Math.floor(lsbBits.length / 8);
            let decoded = bitsToString(lsbBits.slice(0, maxBytes * 8));

            async function decryptMessage(encodedMessage, password) {
                try {
                    const encrypted = Uint8Array.from(atob(encodedMessage), c => c.charCodeAt(0));
                    const salt = encrypted.slice(0, 16);
                    const iv = encrypted.slice(16, 28);
                    const ciphertext = encrypted.slice(28);
                    const enc = new TextEncoder();
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
                        ['decrypt']
                    );
                    const decrypted = await window.crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: iv },
                        key,
                        ciphertext
                    );
                    return new TextDecoder().decode(decrypted);
                } catch (e) {
                    return null;
                }
            }
            const decrypted = await decryptMessage(decoded, password);
            revealedMessageDiv.style.display = '';
            if (decrypted) {
                revealedMessageDiv.textContent = decrypted;
            } else {
                revealedMessageDiv.textContent = 'Failed to reveal or decrypt message.';
            }
        };
        tempImg.src = imgTag.src;
    });

    removeBtn.addEventListener('click', function () {
        if (revealedMessageDiv) revealedMessageDiv.style.display = 'none';
    });
}

function resetHideForm() {
    const imageInput = document.getElementById('image-upload');
    const preview = document.getElementById('image-preview');
    const description = document.getElementById('image-description');
    const passwordInput = document.getElementById('password-input');
    const uploadedImageGroup = document.getElementById('uploaded-image-group');
    const revealedMessageDiv = document.getElementById('revealed-message');

    imageInput.value = '';
    preview.innerHTML = '';
    description.textContent = '';
    passwordInput.value = '';
    uploadedImageGroup.style.display = 'none';
    revealedMessageDiv.style.display = 'none';
}

function extractLSBBits(data) {
    let bits = '';
    for (let i = 0; i < data.length; i++) {
        if ((i % 4) !== 3) {
            bits += (data[i] & 1).toString();
        }
    }
    return bits;
}

function bitsToString(bits) {
    let chars = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = bits.substr(i, 8);
        if (byte.length < 8) break;
        chars.push(String.fromCharCode(parseInt(byte, 2)));
    }
    return chars.join('');
}

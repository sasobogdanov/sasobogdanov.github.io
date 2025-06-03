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

            // Log the first 50 LSB bits from the image for debugging
            let lsbBits = '';
            for (let i = 0, count = 0; i < data.length && count < 50; i++) {
                if ((i % 4) !== 3) {
                    lsbBits += (data[i] & 1).toString();
                    count++;
                }
            }
            console.log('First 50 LSB bits read from image:', lsbBits);

            let lenBits = '';
            let dataIdx = 0;
            // Defensive: avoid infinite loop if image is corrupted or not a stego image
            while (lenBits.length < 32 && dataIdx < data.length) {
                if ((dataIdx % 4) !== 3) {
                    lenBits += (data[dataIdx] & 1).toString();
                }
                dataIdx++;
            }
            if (lenBits.length < 32) {
                revealedMessageDiv.style.display = '';
                revealedMessageDiv.textContent = 'No hidden message found (invalid or corrupted image).';
                return;
            }
            const msgLen = parseInt(lenBits, 2);
            console.log('Extracted message length (bits):', msgLen);
            if (msgLen <= 0 || msgLen > (data.length / 4 * 3)) {
                revealedMessageDiv.style.display = '';
                revealedMessageDiv.textContent = 'No valid hidden message found (invalid length).';
                return;
            }
            let bits = '';
            let bitsRead = 0;
            // Defensive: avoid infinite loop if msgLen is too large
            while (bitsRead < msgLen && dataIdx < data.length) {
                if ((dataIdx % 4) !== 3) {
                    bits += (data[dataIdx] & 1).toString();
                    bitsRead++;
                }
                dataIdx++;
            }
            if (bitsRead < msgLen) {
                revealedMessageDiv.style.display = '';
                revealedMessageDiv.textContent = 'Failed to extract full message (image may be corrupted or not a stego image).';
                return;
            }
            const fullBin = lenBits + bits;;

            function bitsToBytes(bits) {
                const bytes = [];
                for (let i = 0; i < bits.length; i += 8) {
                    const byte = bits.substr(i, 8);
                    if (byte.length < 8) break;
                    bytes.push(parseInt(byte, 2));
                }
                return bytes;
            }
            function bytesToBase64(bytes) {
                let str = '';
                for (let i = 0; i < bytes.length; i++) {
                    str += String.fromCharCode(bytes[i]);
                }
                return str;
            }
            let bytes = bitsToBytes(bits);
            let base64str = bytesToBase64(bytes);
            base64str = base64str.replace(/\0+$/, '');

            async function decryptMessage(base64str, password) {
                try {
                    const encrypted = Uint8Array.from(atob(base64str), c => c.charCodeAt(0));
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
            const decrypted = await decryptMessage(base64str, password);
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

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

    imageInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file && file.type.startsWith('image/')) {
            if (uploadedImageGroup) uploadedImageGroup.style.display = '';
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;

                const img = new window.Image();
                img.onload = function () {
                    description.textContent = `Resolution: ${img.naturalWidth} x ${img.naturalHeight}`;
                    const totalPixels = img.naturalWidth * img.naturalHeight;
                    const totalLSBBits = totalPixels * 3;
                    const maxChars = Math.floor(totalLSBBits / 8);
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

    removeBtn.addEventListener('click', function () {
        resetHideForm();
    });

    const hideMessageBtn = document.getElementById('hide-message-btn');
    if (hideMessageBtn) {
        hideMessageBtn.addEventListener('click', function () {
            console.log('Hide message button pressed');
        });
    }
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

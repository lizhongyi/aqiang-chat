// 上传图片到服务器
        function uploadImageToServer(file) {
            return new Promise((resolve, reject) => {
                // 显示进度条
                uploadProgressContainer.classList.remove('hidden');
                progressBar.style.width = '0%';
                uploadError.classList.add('hidden');

                // 上传图片时发送停止输入状态
                sendTypingStatus(false);

                const formData = new FormData();
                formData.append('image', file);

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload', true);

                // 监听上传进度
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        progressBar.style.width = `${percent}%`;
                    }
                });

                xhr.onload = () => {
                    // 隐藏进度条
                    uploadProgressContainer.classList.add('hidden');

                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            if (response.success && response.imageUrl) {
                                resolve(response.imageUrl);
                            } else {
                                reject(new Error(response.message || languages[currentLang]['chat.uploadError']));
                            }
                        } catch (error) {
                            reject(new Error(languages[currentLang]['chat.uploadError']));
                        }
                    } else {
                        reject(new Error(languages[currentLang]['chat.uploadError']));
                    }
                };

                xhr.onerror = () => {
                    uploadProgressContainer.classList.add('hidden');
                    reject(new Error(languages[currentLang]['chat.uploadError']));
                };

                xhr.send(formData);
            });
        }

        // 处理图片上传
        async function handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // 简单验证文件类型
            if (!file.type.startsWith('image/')) {
                showUploadError(languages[currentLang]['chat.uploadError']);
                return;
            }

            try {
                // 上传图片到服务器
                const imageUrl = await uploadImageToServer(file);

                // 将图片设置为待发送状态
                pendingImage = imageUrl;

                // 显示通知
                pasteNotification.classList.remove('hidden');

                // 3秒后自动隐藏通知
                setTimeout(() => {
                    pasteNotification.classList.add('hidden');
                }, 3000);
            } catch (error) {
                showUploadError(error.message);
            } finally {
                // 重置文件输入，允许重复选择同一文件
                imageUpload.value = '';
            }
        }

        // 处理剪切板粘贴
        async function handlePaste(event) {
            // 只有在聊天面板显示时才处理粘贴
            if (chatPanel.classList.contains('hidden')) return;

            const items = (event.clipboardData || event.originalEvent.clipboardData).items;

            // 检查粘贴内容中是否有图片
            for (let item of items) {
                if (item.kind === 'file') {
                    const file = item.getAsFile();

                    // 检查是否为图片文件
                    if (file.type.startsWith('image/')) {
                        event.preventDefault(); // 阻止默认粘贴行为

                        try {
                            // 上传图片到服务器
                            const imageUrl = await uploadImageToServer(file);

                            // 将图片设置为待发送状态
                            pendingImage = imageUrl;

                            // 显示通知
                            pasteNotification.classList.remove('hidden');

                            // 3秒后自动隐藏通知
                            setTimeout(() => {
                                pasteNotification.classList.add('hidden');
                            }, 3000);
                        } catch (error) {
                            showUploadError(error.message);
                        }

                        return;
                    }
                }
            }

            // 如果有 pendingImage 但粘贴的是文本，清除 pendingImage
            if (pendingImage && items.length > 0 && items[0].kind === 'string') {
                pendingImage = null;
                pasteNotification.classList.add('hidden');

                // 触发输入事件，发送正在输入状态
                setTimeout(handleInput, 0);
            }
        }

        // 显示上传错误
        function showUploadError(message) {
            errorMessage.textContent = message;
            uploadError.classList.remove('hidden');

            // 5秒后自动隐藏错误提示
            setTimeout(() => {
                uploadError.classList.add('hidden');
            }, 5000);
        }


         // 在现有JavaScript代码中添加以下内容

  // 获取模态框元素
  const imageModal = document.getElementById('image-modal');
  const modalImage = document.getElementById('modal-image');
  const closeModal = document.getElementById('close-modal');

  // 打开图片预览
  function openImagePreview(src) {
    modalImage.src = src;
    // 添加动画类
    imageModal.classList.remove('hidden');
    imageModal.classList.add('flex', 'modal-enter');
    setTimeout(() => {
      imageModal.classList.remove('modal-enter');
      imageModal.classList.add('modal-enter-active');
    }, 10);
    
    modalImage.classList.add('image-enter');
    setTimeout(() => {
      modalImage.classList.remove('image-enter');
      modalImage.classList.add('image-enter-active');
    }, 10);
    
    // 阻止页面滚动
    document.body.style.overflow = 'hidden';
  }

  // 关闭图片预览
  function closeImagePreview() {
    imageModal.classList.remove('modal-enter-active');
    imageModal.classList.add('modal-exit-active');
    modalImage.classList.remove('image-enter-active');
    
    setTimeout(() => {
      imageModal.classList.add('hidden');
      imageModal.classList.remove('flex', 'modal-exit', 'modal-exit-active');
      modalImage.src = '';
      // 恢复页面滚动
      document.body.style.overflow = '';
    }, 300);
  }

  // 为聊天区域中的图片添加点击事件委托
  chatMessages.addEventListener('click', (e) => {
    const chatImage = e.target.closest('.chat-image');
    if (chatImage) {
      openImagePreview(chatImage.src);
    }
  });

  // 关闭模态框事件
  closeModal.addEventListener('click', closeImagePreview);
  
  // 点击模态框背景关闭
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      closeImagePreview();
    }
  });

  // 按ESC键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !imageModal.classList.contains('hidden')) {
      closeImagePreview();
    }
  });

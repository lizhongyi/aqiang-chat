
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

  // 确保发送图片时添加chat-image类
  // 在发送图片的代码部分(需要找到现有发送图片的逻辑)添加：
  // 例如，当创建图片消息元素时：
  /*
  const imgElement = document.createElement('img');
  imgElement.src = imageUrl;
  imgElement.className = 'chat-image max-w-[200px] h-auto'; // 添加chat-image类
  */
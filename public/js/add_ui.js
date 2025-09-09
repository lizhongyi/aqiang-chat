// 自定义提示框组件
function createCustomAlert() {
	// 检查是否已存在提示框元素
	let alertContainer = document.getElementById("custom-alert")
	if (!alertContainer) {
		alertContainer = document.createElement("div")
		alertContainer.id = "custom-alert"
		alertContainer.className =
			"fixed inset-0 flex items-center justify-center z-50 hidden"
		alertContainer.innerHTML = `
                    <div class="absolute inset-0 bg-black bg-opacity-50 transition-opacity" id="alert-backdrop"></div>
                    <div class="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4 z-10 transform transition-all">
                        <div class="text-center mb-4">
                            <div class="w-12 h-12 bg-blue-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fa fa-info-circle text-xl"></i>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-900" id="alert-title"></h3>
                            <p class="text-gray-600 mt-2" id="alert-message"></p>
                        </div>
                        <div class="flex justify-center">
                            <button id="alert-confirm-btn" class="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition duration-300">
                                确定
                            </button>
                        </div>
                    </div>
                `
		document.body.appendChild(alertContainer)

		// 添加事件监听
		document
			.getElementById("alert-backdrop")
			.addEventListener("click", hideCustomAlert)
		document
			.getElementById("alert-confirm-btn")
			.addEventListener("click", hideCustomAlert)
	}
	return alertContainer
}

// 自定义确认对话框组件
        function createCustomConfirm() {
            // 检查是否已存在确认框元素
            let confirmContainer = document.getElementById('custom-confirm');
            if (!confirmContainer) {
                confirmContainer = document.createElement('div');
                confirmContainer.id = 'custom-confirm';
                confirmContainer.className = 'fixed inset-0 flex items-center justify-center z-50 hidden';
                confirmContainer.innerHTML = `
                    <div class="absolute inset-0 bg-black bg-opacity-50 transition-opacity" id="confirm-backdrop"></div>
                    <div class="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4 z-10 transform transition-all">
                        <div class="text-center mb-6">
                            <div class="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fa fa-exclamation-triangle text-xl"></i>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-900" id="confirm-title">确认操作</h3>
                            <p class="text-gray-600 mt-2" id="confirm-message"></p>
                        </div>
                        <div class="flex justify-center gap-3">
                            <button id="confirm-cancel-btn" class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition duration-300">
                                取消
                            </button>
                            <button id="confirm-ok-btn" class="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition duration-300">
                                确定
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(confirmContainer);
            }
            return confirmContainer;
        }


          // 隐藏自定义提示框
        function hideCustomAlert() {
            const alertContainer = document.getElementById('custom-alert');
            if (alertContainer) {
                const alertBox = alertContainer.querySelector('div:nth-child(2)');
                alertBox.classList.remove('scale-100', 'opacity-100');
                alertBox.classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    alertContainer.classList.add('hidden');
                }, 200);
            }
        }

             // 隐藏自定义确认对话框
        function hideCustomConfirm() {
            const confirmContainer = document.getElementById('custom-confirm');
            if (confirmContainer) {
                const confirmBox = confirmContainer.querySelector('div:nth-child(2)');
                confirmBox.classList.remove('scale-100', 'opacity-100');
                confirmBox.classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    confirmContainer.classList.add('hidden');
                }, 200);
            }
        }

        // 显示自定义提示框
        function showCustomAlert(title, message, confirmText = '确定', callback = null) {
            const alertContainer = createCustomAlert();
            document.getElementById('alert-title').textContent = title;
            document.getElementById('alert-message').textContent = message;
            document.getElementById('alert-confirm-btn').textContent = confirmText;
            
            // 重置回调函数
            const confirmBtn = document.getElementById('alert-confirm-btn');
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            
            // 添加新的事件监听
            newConfirmBtn.addEventListener('click', () => {
                hideCustomAlert();
                if (callback) callback();
            });
            document.getElementById('alert-backdrop').addEventListener('click', () => {
                hideCustomAlert();
                if (callback) callback();
            });
            
            // 显示提示框
            alertContainer.classList.remove('hidden');
            // 添加动画效果
            const alertBox = alertContainer.querySelector('div:nth-child(2)');
            alertBox.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                alertBox.classList.remove('scale-95', 'opacity-0');
                alertBox.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

         // 向匹配面板添加系统消息
        function addSystemMessageToMatchPanel(content) {
            const existingMessage = matchPanel.querySelector('.system-message');
            if (existingMessage) {
                existingMessage.remove();
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = 'system-message text-sm text-gray-500 mt-4';
            messageDiv.innerHTML = `<i class="fa fa-info-circle mr-1 text-primary"></i>${content}`;

            matchPanel.appendChild(messageDiv);
        }


          // 初始化表情选择器
        function initEmojiPicker() {
            const emojis = ['😊', '😂', '😍', '👍', '❤️', '🎉', '🤔', '😢', '😡', '👏', '🙌', '😉', '😎', '🤷‍♂️', '🙏'];
            const emojiContainer = emojiPicker.querySelector('div');

            emojis.forEach(emoji => {
                const emojiBtn = document.createElement('button');
                emojiBtn.className = 'p-2 hover:bg-gray-100 rounded-full transition';
                emojiBtn.textContent = emoji;
                emojiBtn.addEventListener('click', () => {
                    messageInput.value += emoji;
                    messageInput.focus();
                    // 触发输入事件，发送正在输入状态
                    handleInput();
                });
                emojiContainer.appendChild(emojiBtn);
            });

            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = emojiBtn.getBoundingClientRect();
                emojiPicker.style.top = `${rect.bottom + window.scrollY + 5}px`;
                emojiPicker.style.left = `${rect.left + window.scrollX}px`;
                emojiPicker.classList.toggle('hidden');
            });

            document.addEventListener('click', () => {
                emojiPicker.classList.add('hidden');
            });

            emojiPicker.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
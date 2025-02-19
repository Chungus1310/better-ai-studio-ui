// Global state management
let chatId = Date.now().toString();
let totalTokens = 0;
const MAX_CONTEXT_MESSAGES = 6;
let currentResponseController = null;

// DOM Elements
const textarea = document.querySelector('.message-input');
const sendButton = document.querySelector('.send-button');
const chatMessages = document.getElementById('chatMessages');
const modelSelector = document.querySelector('.model-selector');
const tokenDisplay = document.querySelector('.token-display');
const modeToggle = document.getElementById('modeToggle');
const body = document.body;

// Dark/Light Mode Toggle
function toggleMode() {
    body.classList.toggle('light-mode');
    body.classList.toggle('dark-mode');
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    modeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// Load User Preference
const savedMode = localStorage.getItem('darkMode');
if (savedMode === 'true') {
    body.classList.add('dark-mode');
    modeToggle.innerHTML = '<i class="fas fa-sun"></i>';
} else {
    body.classList.add('light-mode');
    modeToggle.innerHTML = '<i class="fas fa-moon"></i>';
}

modeToggle.addEventListener('click', toggleMode);

// Scroll handling
function scrollToBottom(element, smooth = true) {
    const options = {
        top: element.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    };
    element.scrollTo(options);
}

// Create starfall effect
function createStars() {
    const stars = document.querySelector('.stars');
    const numStars = 50;

    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        star.style.animationDelay = `${Math.random() * 2}s`;
        stars.appendChild(star);
    }
}

// Helper functions
function sanitize(str) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = str;
    return tempDiv.innerHTML
        .replace(/<br>/g, '\n')  // Preserve original newlines
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')  // Convert newlines back after sanitization
        .replace(/&lt;(\/?)(pre|code|strong|em|a|br)&gt;/g, '<$1$2>');
}

function parseMarkdown(text) {
    if (!text) return '';
    
    // Save code blocks temporarily
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        codeBlocks.push(`<pre><code class="language-${lang}">${
            code.trim()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
        }</code></pre>`);
        return `__CODEBLOCK${codeBlocks.length - 1}__`;
    });

    // Process inline code
    const inlineCode = [];
    text = text.replace(/`([^`]+)`/g, (match, code) => {
        inlineCode.push(`<code>${
            code.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
        }</code>`);
        return `__INLINECODE${inlineCode.length - 1}__`;
    });

    // Handle other markdown
    text = text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n/g, '<br>');

    // Restore code blocks
    codeBlocks.forEach((block, i) => {
        text = text.replace(`__CODEBLOCK${i}__`, block);
    });

    // Restore inline code
    inlineCode.forEach((code, i) => {
        text = text.replace(`__INLINECODE${i}__`, code);
    });

    return text;
}

// Update typing speed (from 20 to 10)
function typeText(element, text, speed = 10) {
    let index = 0;
    const initialContent = element.innerHTML;
    
    return new Promise(resolve => {
        function addCharacter() {
            if (index < text.length) {
                // Append character to existing content
                element.innerHTML = initialContent + text.slice(0, index + 1);
                index++;
                setTimeout(addCharacter, speed);
            } else {
                resolve();
            }
        }
        addCharacter();
    });
}

// Error handling
function handleApiError(error, response) {
    let errorMessage = 'An error occurred while processing your request.';
    
    if (error.message.includes('RECITATION')) {
        errorMessage = 'Response was filtered for safety reasons. Please try rephrasing your message.';
    } else if (response?.status === 403) {
        errorMessage = 'Message was filtered due to content safety policies.';
    } else if (response?.status === 404) {
        errorMessage = 'The requested resource was not found.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    return errorMessage;
}

// Token display update
function updateTokenDisplay(tokens) {
    if (!tokenDisplay) return;
    
    totalTokens = tokens.total || totalTokens;
    tokenDisplay.innerHTML = `
        <div>Total Tokens: ${totalTokens}</div>
        <div>Context Messages: ${tokens.context_messages || MAX_CONTEXT_MESSAGES}</div>
    `;
}

// Message management
async function deleteMessage(messageElement, index) {
    try {
        const response = await fetch(`/api/chat/message/${chatId}/${index}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete message: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.success) {
            // Remove the message pair if it exists
            if (data.pair_removed) {
                const nextElement = messageElement.nextElementSibling;
                if (nextElement && nextElement.classList.contains('assistant')) {
                    nextElement.remove();
                }
            }
            messageElement.remove();
            updateTokenDisplay({
                total: data.total_tokens,
                context_messages: data.remaining_messages
            });
        } else {
            throw new Error(data.error || 'Failed to delete message');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        alert(handleApiError(error));
    }
}

function addMessageToChat(content, type, index = -1, animate = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    // Add animation class
    messageDiv.classList.add('message-animate');
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Add delete button to all messages
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete message');
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    
    if (index === -1) {
        index = chatMessages.children.length;
    }
    
    deleteBtn.addEventListener('click', () => deleteMessage(messageDiv, index));
    
    if (type === 'user') {
        contentDiv.innerHTML = sanitize(content);
    } else {
        // For assistant messages, start empty if animating
        contentDiv.innerHTML = animate ? '' : parseMarkdown(content);
    }
    
    messageDiv.appendChild(deleteBtn);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Trigger animation after append
    requestAnimationFrame(() => {
        messageDiv.classList.add('visible');
        scrollToBottom(chatMessages);
    });

    if (type === 'assistant' && animate) {
        return animateAssistantResponse(contentDiv, content);
    }

    return messageDiv;
}

// Update animateAssistantResponse function with simpler node processing
async function animateAssistantResponse(element, content) {
    const formattedContent = parseMarkdown(content);
    const temp = document.createElement('div');
    temp.innerHTML = formattedContent;
    
    const textNodes = [];
    let currentText = '';
    
    function processNode(node) {
        try {
            if (!node) return;
            
            // Simple text node check
            if (!node.tagName) {
                currentText += node.textContent || '';
                return;
            }
            
            const tagName = (node.tagName || '').toUpperCase();
            
            // Handle different node types
            switch (tagName) {
                case 'PRE':
                    if (currentText) {
                        textNodes.push({ type: 'text', content: currentText });
                        currentText = '';
                    }
                    textNodes.push({ type: 'code', content: node.outerHTML });
                    break;
                    
                case 'BR':
                    currentText += '\n';
                    break;
                    
                default:
                    // Process child nodes
                    if (node.childNodes?.length) {
                        if (currentText) {
                            textNodes.push({ type: 'text', content: currentText });
                            currentText = '';
                        }
                        Array.from(node.childNodes).forEach(child => processNode(child));
                    }
                    // Handle HTML elements
                    if (node.outerHTML && tagName) {
                        textNodes.push({ type: 'html', content: node.outerHTML });
                    }
            }
            
        } catch (err) {
            console.error('Error processing node:', err);
        }
    }

    // Process all nodes
    try {
        Array.from(temp.childNodes).forEach(node => processNode(node));
        
        if (currentText) {
            textNodes.push({ type: 'text', content: currentText });
        }
        
        element.innerHTML = '';
        
        // Animate each part
        for (const node of textNodes) {
            if (node.type === 'text') {
                const lines = node.content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (i > 0) element.innerHTML += '<br>';
                    if (lines[i].trim()) {
                        await typeText(element, lines[i], 8);
                    }
                }
            } else {
                element.innerHTML += node.content;
                if (node.type === 'code') {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }
        }
    } catch (err) {
        console.error('Animation error:', err);
        element.innerHTML = formattedContent;
    }
}

function addTypingIndicator() {
    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'message assistant typing';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content typing-indicator';
    contentDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    
    const stopButton = addStopResponseButton();
    indicatorDiv.appendChild(stopButton);
    indicatorDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(indicatorDiv);
    scrollToBottom(chatMessages);
    return indicatorDiv;
}

// Add stop response button
function addStopResponseButton() {
    const button = document.createElement('button');
    button.className = 'btn btn-danger stop-response';
    button.innerHTML = '<i class="fas fa-stop"></i>';
    button.title = 'Stop response';
    button.onclick = () => {
        if (currentResponseController) {
            currentResponseController.abort();
            currentResponseController = null;
        }
    };
    return button;
}

// Chat operations
async function clearChat() {
    try {
        const response = await fetch(`/api/chat/clear/${chatId}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to clear chat: ${response.statusText}`);
        }
        
        chatMessages.innerHTML = '';
        chatId = Date.now().toString();
        totalTokens = 0;
        updateTokenDisplay({ total: 0, context_messages: 0 });
    } catch (error) {
        console.error('Error clearing chat:', error);
        alert(handleApiError(error));
    }
}

async function loadChatHistory() {
    try {
        if (!chatId || chatId === 'undefined') {
            chatId = Date.now().toString();
            return;
        }

        const response = await fetch(`/api/chat/history/${chatId}`);
        if (!response.ok) {
            if (response.status === 404) {
                chatId = Date.now().toString();
                return;
            }
            throw new Error(`Failed to load chat history: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.error && Array.isArray(data.history)) {
            chatMessages.innerHTML = '';
            data.history.forEach((msg, index) => {
                if (msg?.content && msg?.role) {
                    const messageDiv = addMessageToChat(msg.content, msg.role, index);
                    // Instantly show loaded messages
                    messageDiv.style.opacity = '1';
                    messageDiv.style.transform = 'none';
                }
            });
            updateTokenDisplay({
                total: data.tokens,
                context_messages: data.history.length
            });
            // Scroll without animation for initial load
            scrollToBottom(chatMessages, false);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        chatId = Date.now().toString();
    }
}

// Update sendMessage function
async function sendMessage() {
    const message = textarea.value.trim();
    if (!message) return;

    // Cancel any ongoing response
    if (currentResponseController) {
        currentResponseController.abort();
        currentResponseController = null;
    }

    const messageIndex = chatMessages.children.length;
    const formData = new FormData();
    formData.append('message', message);
    formData.append('chatId', chatId);
    formData.append('model', modelSelector.value);

    const userMessage = addMessageToChat(message, 'user', messageIndex, true);
    textarea.value = '';
    textarea.style.height = 'auto';

    const typingIndicator = addTypingIndicator();
    currentResponseController = new AbortController();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
            signal: currentResponseController.signal
        });

        const data = await response.json();
        typingIndicator.remove();
        currentResponseController = null;

        if (!response.ok || data.error) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        await addMessageToChat(data.response, 'assistant', -1, true);
        updateTokenDisplay(data.tokens);

    } catch (error) {
        typingIndicator.remove();
        currentResponseController = null;
        
        if (error.name === 'AbortError') {
            // Handle cancelled request
            addMessageToChat('Response cancelled by user', 'assistant error', -1, true);
        } else {
            const errorMessage = handleApiError(error, response);
            addMessageToChat(errorMessage, 'assistant error', -1, true);
        }
        console.error('Error:', error);
    }
}

// Add export/import functions
function exportChat() {
    fetch(`/api/chat/export/${chatId}`)
        .then(response => response.json())
        .then(data => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat_export_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(error => console.error('Export error:', error));
}

async function importChat(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        const response = await fetch('/api/chat/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            chatId = data.id;
            await loadChatHistory();
        }
    } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import chat');
    }
    event.target.value = ''; // Reset file input
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    createStars();
    loadChatHistory();

    // Auto-resize textarea
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Keep scroll position at bottom when window is resized
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const isAtBottom = chatMessages.scrollTop + chatMessages.clientHeight >= 
                             chatMessages.scrollHeight - 100;
            if (isAtBottom) {
                scrollToBottom(chatMessages, false);
            }
        }, 100);
    });

    // Send message handlers
    sendButton.addEventListener('click', sendMessage);
    textarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});
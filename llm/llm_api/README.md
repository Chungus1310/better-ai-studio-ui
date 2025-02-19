# 🤖 LLM API Wrapper

**One wrapper to rule them all!**  
👋 Welcome to the **LLM API Wrapper** by **Chun**! This library is your ultimate toolkit for interacting with multiple Large Language Model (LLM) providers like **Mistral**, **OpenRouter**, **Hugging Face**, and **Gemini**. Whether you're building AI-powered apps or just experimenting with LLMs, this wrapper has got your back! 🚀

---

## 🌟 **Why Use This?**

- **🔄 Multi-Provider Support**: Switch between Mistral, OpenRouter, Hugging Face, and Gemini effortlessly.
- **🎯 Smart Key Rotation**: Automatically rotate multiple API keys to avoid rate limits.
- **🚀 Dual Mode**: Use it as a **library** in your Python projects or run it as a **local Flask server**.
- **📦 Consistent Output**: Standardized responses across all providers.
- **⚡ Performance First**: Built-in rate limiting and concurrency support.

---

## 🚀 **Quick Start**

### **Prerequisites**
Before diving in, make sure you have:
- **Python 3.8+** installed 🐍
- **pip** (Python package manager) 📦
- **API keys** from your favorite LLM providers 🔑

---

### **Installation**

1. **Clone the repo**:
   ```bash
   git clone https://github.com/chungus1310/llm_api_wrapper.git
   ```

2. **Navigate to the project directory**:
   ```bash
   cd llm_api_wrapper
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

---

### **🔑 Environment Setup**

Create a `.env` file in the root of your project and add your API keys:

```bash
# Mistral API Keys (supports multiple keys for rotation)
MISTRAL_API_KEY1=your_mistral_key_1
MISTRAL_API_KEY2=your_mistral_key_2

# OpenRouter API Key
OPENROUTER_API_KEY=your_openrouter_key

# Hugging Face API Key
HF_API_KEY=your_huggingface_key

# Gemini API Key
GEMINI_API_KEY=your_gemini_key

# Optional: Set a cooldown period between requests (in seconds)
LLM_RATE_LIMIT=0.5
```

---

## 💻 **Usage**

### **1. Library Mode**

Use the wrapper directly in your Python code:

```python
from llm_manager import LLMManager

# Initialize the manager with a rate limit of 0.5 seconds between requests
manager = LLMManager(rate_limit=0.5)

# Make a request to Mistral
response = manager.request(
    prompt="Tell me a joke about AI! 🤖",
    provider="mistral",
    model="mistral-large-latest",
    temperature=0.7
)

print(response)
```

#### **Output Example**:
```json
{
  "provider": "mistral",
  "response": "Why did the AI go on a diet? It had too many bytes! 🍔"
}
```

---

### **2. Server Mode**

Run the wrapper as a local Flask server and make HTTP requests:

1. **Start the server**:
   ```bash
   python app.py
   ```

2. **Make a request using `curl`**:
   ```bash
   curl -X POST http://127.0.0.1:5000/generate \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "Explain quantum computing in simple terms.",
       "provider": "openrouter",
       "model": "openrouter-13b-v1",
       "temperature": 0.7
     }'
   ```

#### **Response Example**:
```json
{
  "provider": "openrouter",
  "response": "Quantum computing is like a supercharged computer that uses qubits instead of bits. It can solve problems much faster than regular computers! ⚛️"
}
```

---

## 🛠️ **How It Works**

### **Key Features**

1. **🔑 API Key Rotation**:
   - The wrapper automatically rotates through multiple API keys for each provider (e.g., `MISTRAL_API_KEY1`, `MISTRAL_API_KEY2`).
   - If one key hits a rate limit, the wrapper switches to the next key seamlessly.

2. **🌐 Multi-Provider Support**:
   - Supports **Mistral**, **OpenRouter**, **Hugging Face**, and **Gemini**.
   - Each provider has its own implementation, ensuring compatibility with their APIs.

3. **⏱️ Rate Limiting**:
   - You can set a cooldown period (`LLM_RATE_LIMIT`) between requests to avoid hitting API limits.

4. **📡 Dual Mode**:
   - Use it as a **library** in your Python projects.
   - Or run it as a **Flask server** for easy HTTP access.

---

## 🛡️ **Security Tips**

- **🔒 Never commit API keys** to version control (e.g., GitHub). Use `.env` files and add them to `.gitignore`.
- **📝 Use environment variables** to store sensitive information.
- **🤫 Keep your `.env` file secret** and share it only with trusted collaborators.
- **🔍 Monitor your API usage** to avoid unexpected charges.

---

## 🔧 **Troubleshooting**

| Issue                        | Solution                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| **🔑 No keys found**          | Check your `.env` file and ensure the keys are correctly named.          |
| **⏰ Timeouts**               | Increase timeout settings or check your internet connection.             |
| **❌ API limits exceeded**    | Add more API keys or wait for the rate limit to reset.                   |
| **🚫 Invalid provider**       | Ensure the provider name is one of: `mistral`, `openrouter`, `huggingface`, `gemini`. |

---

## 🤝 **Contributing**

We love contributions! Here's how you can help:

1. **🍴 Fork the repo**.
2. **🌱 Create your feature branch**:
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **💪 Make your changes**.
4. **🚀 Open a Pull Request**.

---

## 📝 **License**

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute it in your projects! 🎉

---

## **🌟 Made with ❤️ by Chun**

- **GitHub**: [chungus1310](https://github.com/chungus1310)
- **Follow me**: [![GitHub Follow](https://img.shields.io/github/followers/chungus1310?style=social)](https://github.com/chungus1310)

---

### **Happy Coding!** 🚀🤖
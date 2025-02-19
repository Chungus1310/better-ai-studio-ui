from flask import Flask, request, jsonify, render_template
from llm.llm_api.llm_manager import LLMManager
import json
import os
from dotenv import load_dotenv
import tiktoken
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', template_folder='templates')
load_dotenv()

# Initialize LLM manager and chat storage
llm_manager = LLMManager(rate_limit=float(os.environ.get("LLM_RATE_LIMIT", 0.5)))
tokenizer = tiktoken.get_encoding("cl100k_base")
chat_histories = {}

# File upload configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def count_tokens(text: str) -> int:
    return len(tokenizer.encode(text))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    chat_id = request.form.get('chatId')
    message = request.form.get('message')
    model = request.form.get('model', 'gemini-2.0-flash')  # Always use flash model
    
    if not chat_id or not message:
        return jsonify({"error": "Chat ID and message are required"}), 400
    
    # Get last 6 messages as context
    if chat_id not in chat_histories:
        chat_histories[chat_id] = []
    
    message_tokens = count_tokens(message)
    chat_histories[chat_id].append({
        "role": "user",
        "content": message,
        "tokens": message_tokens
    })
    
    context = chat_histories[chat_id][-6:] if len(chat_histories[chat_id]) > 6 else chat_histories[chat_id]
    context_text = "\n".join([f"{'User' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}" for msg in context])
    context_tokens = count_tokens(context_text)
    
    full_prompt = f"Previous conversation:\n{context_text}\n\nUser: {message}\nAssistant:"
    total_prompt_tokens = count_tokens(full_prompt)
    
    try:
        response = llm_manager.request(
            prompt=full_prompt,
            provider="gemini",
            model=model,
            temperature=0.7,
            top_p=0.9
        )
        
        if "error" in response:
            error_message = response["error"]
            if "RECITATION" in error_message:
                return jsonify({
                    "error": "Response was filtered for safety reasons. Please try rephrasing your message."
                }), 403
            return jsonify({"error": error_message}), 500

        if not response.get("response") or not response["response"].get("text"):
            return jsonify({
                "error": "Invalid response from language model"
            }), 500
        
        try:
            assistant_response = response["response"]["text"]
            response_tokens = count_tokens(assistant_response)
            
            chat_histories[chat_id].append({
                "role": "assistant",
                "content": assistant_response,
                "tokens": response_tokens
            })
        except Exception as e:
            return jsonify({
                "error": f"Error processing response: {str(e)}"
            }), 500
        
        total_conversation_tokens = sum(msg.get("tokens", 0) for msg in chat_histories[chat_id])
        
        return jsonify({
            "response": assistant_response,
            "chatId": chat_id,
            "model": model,
            "tokens": {
                "message": message_tokens,
                "response": response_tokens,
                "context": context_tokens,
                "total": total_conversation_tokens,
                "prompt": total_prompt_tokens
            },
            "context_messages": len(context)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/message/<chat_id>/<int:index>', methods=['DELETE'])
def delete_message(chat_id, index):
    if chat_id not in chat_histories:
        return jsonify({"error": "Chat not found"}), 404
    
    try:
        if 0 <= index < len(chat_histories[chat_id]):
            # Remove the message
            chat_histories[chat_id].pop(index)
            
            # If this was a user message, remove the corresponding assistant message
            pair_removed = False
            if index + 1 < len(chat_histories[chat_id]):
                chat_histories[chat_id].pop(index)
                pair_removed = True
            
            total_tokens = sum(msg.get("tokens", 0) for msg in chat_histories[chat_id])
            return jsonify({
                "success": True,
                "total_tokens": total_tokens,
                "remaining_messages": len(chat_histories[chat_id]),
                "pair_removed": pair_removed
            })
        return jsonify({"error": "Message index out of range"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/clear/<chat_id>', methods=['POST'])
def clear_chat(chat_id):
    if chat_id in chat_histories:
        chat_histories[chat_id] = []
    return jsonify({"success": True})

@app.route('/api/models')
def get_models():
    return jsonify({
        "models": [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite-preview-02-05",
            "gemini-2.0-pro-exp-02-05",
            "gemini-2.0-flash-thinking-exp-01-21"
        ]
    })

@app.route('/api/chat/history/<chat_id>')
def get_chat_history(chat_id):
    if chat_id not in chat_histories:
        # Initialize empty chat history for new IDs
        chat_histories[chat_id] = []
    
    return jsonify({
        "history": chat_histories[chat_id],
        "tokens": sum(msg.get("tokens", 0) for msg in chat_histories[chat_id])
    })

@app.route('/api/chat/export/<chat_id>')
def export_chat(chat_id):
    if chat_id not in chat_histories:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({
        "id": chat_id,
        "messages": chat_histories[chat_id],
        "tokens": sum(msg.get("tokens", 0) for msg in chat_histories[chat_id])
    })

@app.route('/api/chat/import', methods=['POST'])
def import_chat():
    data = request.json
    if not data or 'id' not in data or 'messages' not in data:
        return jsonify({"error": "Invalid chat data"}), 400
    
    chat_histories[data['id']] = data['messages']
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

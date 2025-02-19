import os
from flask import Flask, request, jsonify
from llm_manager import LLMManager

app = Flask(__name__)

# Create a global LLMManager instance with a default rate_limit of 0 seconds.
# Adjust as needed or allow the user to pass a rate_limit from environment if desired.
llm_manager = LLMManager(rate_limit=float(os.environ.get("LLM_RATE_LIMIT", 0.0)))

@app.route("/generate", methods=["POST"])
def generate():
    """
    Expects JSON with:
    {
      "prompt": "...",
      "provider": "mistral" | "openrouter" | "huggingface" | "gemini",
      "model": "...",
      "temperature": (optional) 1.0,
      "top_p": (optional) 1.0,
      ...
    }
    """
    data = request.json
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    prompt = data.get("prompt", "")
    provider = data.get("provider", "")
    model = data.get("model", "")
    temperature = data.get("temperature", 1.0)
    top_p = data.get("top_p", 1.0)

    if not prompt or not provider or not model:
        return jsonify({"error": "Prompt, provider, and model are required"}), 400

    if provider not in ["mistral", "huggingface", "gemini"]:
        return jsonify({"error": "Invalid provider"}), 400

    result = llm_manager.request(
        prompt=prompt,
        provider=provider,
        model=model,
        temperature=temperature,
        top_p=top_p
    )
    return jsonify(result), 200

if __name__ == "__main__":
    # Run the Flask server locally
    app.run(host="127.0.0.1", port=5000, debug=False)
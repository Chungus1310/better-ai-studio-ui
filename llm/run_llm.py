from llm_api.llm_manager import LLMManager
import os
from dotenv import load_dotenv

def test_gemini():
    # Load environment variables from .env file
    load_dotenv()

    # Initialize the LLM manager with a rate limit of 0.5 seconds
    manager = LLMManager(rate_limit=0.5)

    # Test prompts
    prompts = [
        "Explain quantum computing in simple terms.",
        "Write a short poem about artificial intelligence.",
        "What are the main differences between Python and JavaScript?",
        "What are the main differences between Python and JavaScript?",
        "What are the main differences between Python and JavaScript?"
    ]

    # Gemini model options
    models = [
        "gemini-2.0-pro-exp-02-05",  # Text generation
        "gemini-pro-vision"  # Multi-modal (text + images)
    ]

    print("🤖 Testing Gemini API...\n")

    for prompt in prompts:
        print(f"📝 Prompt: {prompt}")
        
        try:
            response = manager.request(
                prompt=prompt,
                provider="gemini",
                model=models[0],  # Using gemini-pro for text
                temperature=0.7,
                top_p=0.9
            )

            if "error" in response:
                print(f"❌ Error: {response['error']}\n")
            else:
                print(f"✅ Response from {response['provider']}:")
                print(f"{response['response']['text']}\n")

        except Exception as e:
            print(f"❌ Exception occurred: {str(e)}\n")

if __name__ == "__main__":
    test_gemini()

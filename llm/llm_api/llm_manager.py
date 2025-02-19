import os
import time
from typing import Optional, Dict, Any, List
import google.generativeai as genai
from huggingface_hub import InferenceClient
from mistralai import Mistral

class LLMProviderBase:
    """A base class that all LLM providers should inherit from.
    Provides common functionality for API key management and request handling."""
    
    def __init__(self, provider_name: str, api_keys: List[str]):
        self.provider_name = provider_name
        self.api_keys = api_keys  # Store multiple API keys for rotation
        self.key_index = 0

    def get_api_key(self) -> Optional[str]:
        """Rotates through available API keys in a round-robin fashion"""
        if not self.api_keys:
            return None
        key = self.api_keys[self.key_index]
        self.key_index = (self.key_index + 1) % len(self.api_keys)
        return key

    def send_request(
        self,
        prompt: str,
        model: str,
        temperature: float,
        top_p: float,
        **kwargs
    ) -> Dict[str, Any]:
        """Base method for sending requests to the LLM provider.
        Must be implemented by each provider class."""
        raise NotImplementedError("Each provider must implement their own send_request method")

class MistralProvider(LLMProviderBase):
    def send_request(
        self,
        prompt: str,
        model: str,
        temperature: float,
        top_p: float,
        **kwargs
    ) -> Dict[str, Any]:
        api_key = self.get_api_key()
        if not api_key:
            return {"error": "No Mistral API key available"}
        
        try:
            client = Mistral(api_key=api_key)
            chat_response = client.chat.complete(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            return {
                "provider": "mistral",
                "response": {"text": chat_response.choices[0].message.content}
            }
        except Exception as e:
            return {"error": str(e)}

class HuggingFaceProvider(LLMProviderBase):
    def send_request(
        self,
        prompt: str,
        model: str,
        temperature: float,
        top_p: float,
        **kwargs
    ) -> Dict[str, Any]:
        api_key = self.get_api_key()
        if not api_key:
            return {"error": "No Hugging Face API key available"}
        
        try:
            client = InferenceClient(api_key=api_key)
            messages = [{"role": "user", "content": prompt}]
            response = ""
            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=2048,
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    response += chunk.choices[0].delta.content
            return {"provider": "huggingface", "response": {"text": response}}
        except Exception as e:
            return {"error": str(e)}

class GeminiProvider(LLMProviderBase):
    def __init__(self, provider_name: str, api_keys: List[str]):
        super().__init__(provider_name, api_keys)
        # Configure minimal safety settings for more permissive responses
        self.safety_settings = {
            "HARM_CATEGORY_HARASSMENT": "BLOCK_NONE",
            "HARM_CATEGORY_HATE_SPEECH": "BLOCK_NONE",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_NONE",
            "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_NONE",
        }

    def send_request(
        self,
        prompt: str,
        model: str,
        temperature: float,
        top_p: float,
        image_path: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        api_key = self.get_api_key()
        if not api_key:
            return {"error": "No Gemini API key available"}
        
        try:
            genai.configure(api_key=api_key)
            generation_config = {
                "temperature": temperature,
                "top_p": top_p,
                "top_k": 64,
                "max_output_tokens": 8192,
            }

            if image_path and model == 'gemini-pro-vision':
                # Handle image input
                image_file = genai.upload_file(path=image_path)
                model_instance = genai.GenerativeModel(
                    model_name='gemini-pro-vision',
                    generation_config=generation_config,
                    safety_settings=self.safety_settings
                )
                response = model_instance.generate_content([prompt, image_file])
            else:
                # Text-only input
                model_instance = genai.GenerativeModel(
                    model_name=model,
                    generation_config=generation_config,
                    safety_settings=self.safety_settings
                )
                chat = model_instance.start_chat(history=[])
                response = chat.send_message(prompt)

            return {
                "provider": "gemini",
                "response": {"text": response.text}
            }
        except Exception as e:
            return {"error": str(e)}

class LLMManager:
    """Main orchestrator for managing multiple LLM providers and handling requests"""
    
    def __init__(self, rate_limit: float = 0.0):
        """Initialize the LLM manager with optional rate limiting
        
        Args:
            rate_limit: Seconds to wait between requests (useful for API rate limits)
        """
        self.rate_limit = rate_limit
        self.providers = {}

        # Load API keys for all supported providers
        self._load_provider_keys("mistral", "MISTRAL_KEY")
        self._load_provider_keys("huggingface", "HF_KEY")
        self._load_provider_keys("gemini", "GEMINI_API_KEY")

    def _load_provider_keys(self, provider_name: str, env_prefix: str):
        """Load API keys from environment variables for a specific provider"""
        keys = []
        
        # Try numbered keys first (e.g., MISTRAL_KEY1, MISTRAL_KEY2)
        index = 1
        while True:
            env_var = f"{env_prefix}{index}"
            if env_var in os.environ:
                keys.append(os.environ[env_var])
                index += 1
            else:
                break

        # Fall back to single key if no numbered keys found
        if not keys and env_prefix in os.environ:
            keys.append(os.environ[env_prefix])

        # Initialize appropriate provider if keys are available
        if keys:
            provider_classes = {
                "mistral": MistralProvider,
                "huggingface": HuggingFaceProvider,
                "gemini": GeminiProvider
            }
            self.providers[provider_name] = provider_classes[provider_name](provider_name, keys)
        else:
            self.providers[provider_name] = None

    def request(
        self,
        prompt: str,
        provider: str,
        model: str,
        temperature: float = 1.0,
        top_p: float = 1.0,
        **kwargs
    ) -> Dict[str, Any]:
        """Send a request to a specific LLM provider
        
        Args:
            prompt: The input text to send to the model
            provider: Name of the provider to use
            model: Model identifier for the specific provider
            temperature: Controls randomness in the output (0.0 to 1.0)
            top_p: Controls diversity via nucleus sampling (0.0 to 1.0)
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Dictionary containing the response or error information
        """
        if provider not in self.providers or not self.providers[provider]:
            return {"error": f"Provider '{provider}' is not configured or has no API keys."}

        time.sleep(self.rate_limit)
        handler = self.providers[provider]
        return handler.send_request(prompt, model, temperature, top_p, **kwargs)
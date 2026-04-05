from transformers import pipeline

model = pipeline(
    "text-generation",
    model="meta-llama/Meta-Llama-3-8B-Instruct"
)

prompt = """
Analyze the following TLS configuration and recommend post quantum upgrades.

TLS Version: TLS1.2
Cipher: RSA_WITH_AES_256_GCM_SHA384
Certificate: RSA 2048
"""

result = model(prompt, max_length=200)

print(result[0]['generated_text'])
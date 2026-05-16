# file: Semantic.py — Topic relevance scoring using sentence-transformers
from sentence_transformers import SentenceTransformer, util
import nltk

# Download punkt tokenizer data (safe to call multiple times — no-op if already present)
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
from nltk.tokenize import sent_tokenize

# Load model once at import time to avoid repeated loading overhead
model = SentenceTransformer("all-MiniLM-L6-v2")

def compute_relevance(topic: str, transcript: str, debug: bool = False) -> int:
    """
    Computes topic relevance score (1-10) for a transcript.
    :param topic: The topic or prompt string.
    :param transcript: The full speech transcript.
    :param debug: If True, prints intermediate values for debugging.
    :return: Integer score between 1 and 10.
    """
    # --- Step 1: Preprocess transcript ---
    transcript = transcript.strip().lower()
    sentences = sent_tokenize(transcript)

    if not sentences:
        if debug:
            print("⚠️ No sentences found in transcript.")
        return 1  # No input = lowest score

    # --- Step 2: Encode topic and sentences ---
    topic_embedding = model.encode(topic, convert_to_tensor=True)
    sentence_embeddings = model.encode(sentences, convert_to_tensor=True)

    # --- Step 3: Compute similarity scores ---
    similarities = util.cos_sim(sentence_embeddings, topic_embedding).cpu().numpy().flatten()

    # --- Step 4: Proportional scoring ---
    relevant_count = sum(sim >= 0.50 for sim in similarities)
    relevance_percent = (relevant_count / len(sentences)) * 100

    if relevance_percent >= 85:
        proportional_score = 10
    elif relevance_percent >= 71:
        proportional_score = 9
    elif relevance_percent >= 51:
        proportional_score = 7
    elif relevance_percent >= 31:
        proportional_score = 5
    elif relevance_percent >= 11:
        proportional_score = 3
    else:
        proportional_score = 1

    # --- Step 5: Weighted average scoring ---
    avg_score = round(similarities.mean() * 10)

    # --- Final score = average of both methods ---
    final_score = round((proportional_score + avg_score) / 2)
    final_score = max(1, min(10, final_score))  # Clamp between 1–10

    # ✅ Optional debug logging
    if debug:
        print(f"Sentences: {sentences}")
        print(f"Similarities: {similarities}")
        print(f"Relevant count: {relevant_count}/{len(sentences)}")
        print(f"Relevance %: {relevance_percent:.2f}")
        print(f"Proportional score: {proportional_score}")
        print(f"Average score: {avg_score}")
        print(f"Final score: {final_score}")

    return final_score

if __name__ == "__main__":
    # ✅ Take inputs from user for standalone testing
    topic = input("Enter the topic: ")
    transcript = input("Enter the speech transcript: ")

    score = compute_relevance(topic, transcript, debug=True)
    print(f"\nTopic Relevance Score (1-10): {score}")

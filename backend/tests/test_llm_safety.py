"""The output-side word filter for student-facing generation
(backend.llm.safety) -- no DB, no LLM call, just the regexes."""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from backend.llm import safety


class SanitizeTests(unittest.TestCase):
    def test_english_profanity_is_redacted(self):
        clean, caught = safety.sanitize("That is such a fucking stupid idea.")
        self.assertNotIn("fucking", clean.lower())
        self.assertEqual(caught, ["fucking"])
        # "stupid" has no listed ban -- a blunt filter on mild adjectives
        # would garble ordinary encouraging sentences ("not a stupid
        # question"), so only clearly-profane words are caught.
        self.assertIn("stupid", clean)

    def test_hindi_profanity_latin_is_redacted(self):
        clean, caught = safety.sanitize("Tu bahut chutiya hai.")
        self.assertNotIn("chutiya", clean.lower())
        self.assertEqual(caught, ["chutiya"])

    def test_hindi_profanity_devanagari_is_redacted(self):
        clean, caught = safety.sanitize("तू हरामी है।")
        self.assertNotIn("हरामी", clean)
        self.assertEqual(caught, ["हरामी"])

    def test_lowercase_babu_is_redacted(self):
        clean, caught = safety.sanitize("Theek hai babu, chaliye shuru karte hain.")
        self.assertNotIn("babu", clean.lower())
        self.assertEqual(caught, ["babu"])

    def test_capitalized_babu_in_a_real_name_is_kept(self):
        # "Babu Kunwar Singh" is a real BSEB-syllabus historical figure --
        # the filter must never touch a capitalized "Babu".
        text = "Babu Kunwar Singh ek swatantrata senani the."
        clean, caught = safety.sanitize(text)
        self.assertEqual(clean, text)
        self.assertEqual(caught, [])

    def test_babuji_is_kept(self):
        text = "Babuji ne 1857 ke baare mein bataya."
        clean, caught = safety.sanitize(text)
        self.assertEqual(clean, text)
        self.assertEqual(caught, [])

    def test_devanagari_babu_as_address_is_redacted(self):
        clean, caught = safety.sanitize("ठीक है बाबू, चलिए शुरू करते हैं।")
        self.assertNotIn("बाबू", clean)
        self.assertEqual(caught, ["बाबू"])

    def test_devanagari_babu_in_a_real_name_is_kept(self):
        text = "बाबू कुँवर सिंह एक स्वतंत्रता सेनानी थे।"
        clean, caught = safety.sanitize(text)
        self.assertEqual(clean, text)
        self.assertEqual(caught, [])

    def test_ordinary_words_that_double_as_mild_insults_are_kept(self):
        # These have a legitimate, common meaning in school content (animals,
        # family, dates) and must survive the filter untouched.
        for text in (
            "Kutta ek paltu jaanwar hai.",
            "Mera saala Patna mein rehta hai.",
            "Sikandar 326 BC mein Bharat aaya.",
        ):
            clean, caught = safety.sanitize(text)
            self.assertEqual(clean, text)
            self.assertEqual(caught, [])

    def test_clean_text_is_returned_unchanged(self):
        text = "Photosynthesis ek process hai jisme paudhe apna khana banate hain."
        clean, caught = safety.sanitize(text)
        self.assertEqual(clean, text)
        self.assertEqual(caught, [])


class SplitSafePrefixTests(unittest.TestCase):
    def test_nothing_to_flush_without_a_boundary(self):
        self.assertIsNone(safety.split_safe_prefix("hello"))

    def test_flushes_up_to_the_last_whitespace(self):
        ready, remainder = safety.split_safe_prefix("hello wor")
        self.assertEqual(ready, "hello ")
        self.assertEqual(remainder, "wor")

    def test_flushes_everything_past_the_max_buffer_with_no_whitespace(self):
        buf = "a" * 90
        ready, remainder = safety.split_safe_prefix(buf)
        self.assertEqual(ready, buf)
        self.assertEqual(remainder, "")

    def test_a_banned_word_split_across_deltas_is_still_caught(self):
        # Simulates an LLM stream handing the word to the caller in
        # arbitrary-sized fragments that don't land on word boundaries.
        deltas = ["Tu ", "bahut ", "chut", "iya ", "hai."]
        buf = ""
        out = []
        for d in deltas:
            buf += d
            split = safety.split_safe_prefix(buf)
            if split is None:
                continue
            ready, buf = split
            _, caught = safety.sanitize(ready)
            out.extend(caught)
        if buf:
            clean, caught = safety.sanitize(buf)
            out.extend(caught)
        self.assertIn("chutiya", out)


if __name__ == "__main__":
    unittest.main()

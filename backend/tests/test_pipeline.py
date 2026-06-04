import unittest
import asyncio
from unittest.mock import patch, MagicMock
from core.data_loader import filter_dataset_robust
from core.timeline_builder import prune_log_for_ai, assemble_timeline
from core.prompt_builder import build_system_prompt
from core.model_router import ModelRouter, ModelResult
from core.consensus_engine import citation_matrix, bertscore_pairwise, calculate_overall_confidence
from core.config import settings

# Priority Event IDs: 1, 3, 4624 (assuming 4624 is valid priority logon), 4688
RAW_EVENTS = [
    {"EventID": 4624, "UtcTime": "2023-01-01 12:00:00", "User": "Admin", "UnusedField": "IgnoreMe"},
    {"EventID": 1, "UtcTime": "2023-01-01 12:05:00", "CommandLine": "mimikatz.exe", "ProcessId": 1234},
    {"EventID": 3, "UtcTime": "2023-01-01 12:06:00", "DestinationIp": "10.0.0.5", "Protocol": "tcp"},
]

MOCK_MODEL_TEXT_A = "The incident started when User Admin logged in [LOG_ID: 1].\nThe attacker then executed mimikatz [LOG_ID: 2].\nThe process made a network connection to 10.0.0.5 [LOG_ID: 3]."
MOCK_MODEL_TEXT_B = "A successful logon occurred for Admin [LOG_ID: 1]. Mimikatz was executed [LOG_ID: 2] to steal credentials. However, I also found a suspicious file drop [LOG_ID: 99]." 
MOCK_MODEL_TEXT_UNCITED = "The incident started when User Admin logged in. The attacker then executed mimikatz. The process made a network connection."

async def mock_progress(event):
    pass

class TestPipeline(unittest.TestCase):

    def test_data_filtering(self):
        # We temporarily inject 4624 to priority to ensure it passes
        original_prio = settings.priority_event_ids
        settings.priority_event_ids = [1, 3, 4624]
        filtered = filter_dataset_robust(RAW_EVENTS)
        self.assertEqual(len(filtered), 3)
        self.assertEqual(filtered[1]["CommandLine"], "mimikatz.exe")
        settings.priority_event_ids = original_prio

    def test_timeline_building(self):
        pruned = prune_log_for_ai(RAW_EVENTS[0])
        self.assertNotIn("UnusedField", pruned)
        self.assertIn("User", pruned)

        timeline_str, metadata = assemble_timeline(RAW_EVENTS, max_events=2)
        self.assertEqual(metadata["events_included"], 2)
        self.assertEqual(metadata["events_truncated"], 1)
        self.assertIn("[LOG_ID: 1]", timeline_str)
        self.assertNotIn("[LOG_ID: 3]", timeline_str)

    def test_prompt_builder(self):
        prompt = build_system_prompt("[LOG_ID: 1]")
        self.assertIn("CRITICAL", prompt)
        self.assertIn("[LOG_ID: 1]", prompt)



    def test_consensus_matrix(self):
        results = {
            "model_a": ModelResult(model_id="model_a", text=MOCK_MODEL_TEXT_A, citations=[1, 2, 3]),
            "model_b": ModelResult(model_id="model_b", text=MOCK_MODEL_TEXT_B, citations=[1, 2, 99]),
        }
        matrix = citation_matrix(results, total_log_ids=3)
        self.assertEqual(matrix["LOG_ID_1"]["status"], "CONFIRMED")
        self.assertEqual(matrix["LOG_ID_3"]["status"], "UNVERIFIED")
        self.assertEqual(matrix["LOG_ID_99"]["status"], "PHANTOM")

    def test_overall_confidence(self):
        results = {
            "model_a": ModelResult(model_id="model_a", text=MOCK_MODEL_TEXT_A, citations=[1, 2, 3]),
            "model_b": ModelResult(model_id="model_b", text=MOCK_MODEL_TEXT_B, citations=[1, 2, 99]),
        }
        matrix = citation_matrix(results, total_log_ids=3)
        scores = {"model_a_vs_model_b": 0.85}
        confidence = calculate_overall_confidence(matrix, scores)
        self.assertGreaterEqual(confidence, 0.0)

    def test_anonymizer(self):
        from core.anonymizer import LogAnonymizer
        anonymizer = LogAnonymizer()
        
        events = [
            {"EventID": 3, "UtcTime": "2023-01-01 12:06:00", "DestinationIp": "10.0.0.5", "User": "THESHIRE\\pgustavo", "Computer": "WORKSTATION5.theshire.local"},
            {"EventID": 1, "UtcTime": "2023-01-01 12:07:00", "CommandLine": "ping 10.0.0.5 by pgustavo on WORKSTATION5.theshire.local"},
        ]
        
        anonymizer.analyze_and_build_maps(events)
        
        # Check mapping populated
        self.assertIn("10.0.0.5", anonymizer.ip_map)
        self.assertIn("pgustavo", anonymizer.user_map)
        self.assertIn("WORKSTATION5", anonymizer.host_map)
        self.assertIn("theshire.local", anonymizer.domain_map)
        self.assertIn("THESHIRE", anonymizer.domain_map)
        
        # Verify ignored users are not mapped
        self.assertNotIn("SYSTEM", anonymizer.user_map)
        self.assertNotIn("NT AUTHORITY", anonymizer.domain_map)
        
        # Test anonymization
        anon_events = anonymizer.anonymize_events(events)
        self.assertEqual(anon_events[0]["DestinationIp"], anonymizer.ip_map["10.0.0.5"])
        self.assertEqual(anon_events[0]["User"], f"{anonymizer.domain_map['THESHIRE']}\\{anonymizer.user_map['pgustavo']}")
        self.assertIn(anonymizer.ip_map["10.0.0.5"], anon_events[1]["CommandLine"])
        self.assertIn(anonymizer.user_map["pgustavo"], anon_events[1]["CommandLine"])
        
        # Test de-anonymization
        narrative = f"The client {anonymizer.user_map['pgustavo']} from {anonymizer.host_map['WORKSTATION5']} contacted {anonymizer.ip_map['10.0.0.5']}."
        restored = anonymizer.deanonymize_text(narrative)
        self.assertEqual(restored, "The client pgustavo from WORKSTATION5 contacted 10.0.0.5.")

if __name__ == '__main__':
    unittest.main()

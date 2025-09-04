/*
  # Add Test Data for Response Analysis

  1. New Records
    - 25 records in `response_analysis` table
    - 5 records for each response (IDs: 91, 92, 93, 94, 95)
    - 5 competitors for each response (IDs: 144, 145, 146, 147, 148)
    - Varied values for company_appears, sentiment, and position

  2. Data Distribution
    - company_appears: Mix of true/false values
    - sentiment: Range from 20 to 95 (realistic sentiment scores)
    - position: Range from 1 to 10 (search result positions)
*/

-- Insert test data for response analysis
INSERT INTO response_analysis (response, competitor, company_appears, sentiment, position) VALUES
-- Response 91 with all 5 competitors
(91, 144, true, 85, 2),
(91, 145, false, 45, 7),
(91, 146, true, 72, 1),
(91, 147, false, 38, 9),
(91, 148, true, 91, 3),

-- Response 92 with all 5 competitors
(92, 144, false, 52, 6),
(92, 145, true, 78, 4),
(92, 146, false, 29, 10),
(92, 147, true, 88, 1),
(92, 148, false, 41, 8),

-- Response 93 with all 5 competitors
(93, 144, true, 67, 3),
(93, 145, true, 95, 1),
(93, 146, false, 33, 9),
(93, 147, false, 56, 5),
(93, 148, true, 74, 2),

-- Response 94 with all 5 competitors
(94, 144, false, 48, 8),
(94, 145, false, 22, 10),
(94, 146, true, 81, 4),
(94, 147, true, 69, 6),
(94, 148, false, 37, 7),

-- Response 95 with all 5 competitors
(95, 144, true, 93, 1),
(95, 145, false, 44, 9),
(95, 146, false, 58, 5),
(95, 147, true, 76, 3),
(95, 148, true, 62, 4);
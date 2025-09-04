/*
  # Enable pg_net extension

  1. Extensions
    - Enable `pg_net` extension to provide network functionality
    - This resolves the "schema 'net' does not exist" error

  This extension is required for certain database operations and triggers
  that may be using network-related functions.
*/

-- Enable the pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;
'use strict';

/**
 * Generic JSON-file-backed repository abstraction.
 *
 * Business code must depend on this interface only — never on `fs`/file paths
 * directly. When AsiaPower migrates a given store to Supabase/Postgres, only
 * the implementation passed into `createJsonRepository` (or a new
 * `createSqlRepository` with the same method names) needs to change.
 */

const { loadJson, saveJsonAtomic } = require('../json-store');

/**
 * @param {string} file Absolute path to the JSON file backing this repository.
 * @param {object} emptyState Default shape written if the file doesn't exist yet.
 */
function createJsonRepository(file, emptyState) {
  function read() {
    return loadJson(file, emptyState, { createIfMissing: true });
  }

  function write(data) {
    saveJsonAtomic(file, data);
    return data;
  }

  /** Read-modify-write with the mutator receiving the current state. */
  function update(mutateFn) {
    const current = read();
    const next = mutateFn(current) || current;
    write(next);
    return next;
  }

  return { file, read, write, update };
}

module.exports = { createJsonRepository };

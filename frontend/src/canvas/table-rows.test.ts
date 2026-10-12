import { describe, expect, it } from 'vitest';
import { classRows, tableRows } from './table-rows';

describe("a table's rows, read as typed", () => {
  it('reads a name, a type and keys', () => {
    expect(tableRows('id int pk')).toEqual([{ name: 'id', type: 'int', keys: ['PK'] }]);
  });

  it('keeps a type of several words, and keys in any case and either spelling', () => {
    expect(tableRows('total double precision UNIQUE fk\nowner varchar(255) Foreign_Key primary_key unq')).toEqual([
      { name: 'total', type: 'double precision', keys: ['UNQ', 'FK'] },
      { name: 'owner', type: 'varchar(255)', keys: ['FK', 'PK', 'UNQ'] },
    ]);
  });

  it('reads a row with no type or no keys, and skips blank lines', () => {
    expect(tableRows('  \nnotes\n\ncreated_at   timestamp  \n')).toEqual([
      { name: 'notes', type: '', keys: [] },
      { name: 'created_at', type: 'timestamp', keys: [] },
    ]);
  });

  it('reads a quoted name as one name, spaces and all', () => {
    expect(tableRows('"first name" text pk')).toEqual([{ name: 'first name', type: 'text', keys: ['PK'] }]);
    expect(tableRows('"unclosed name text')).toEqual([{ name: '"unclosed', type: 'name text', keys: [] }]);
  });

  it('never reads the first word as a key', () => {
    expect(tableRows('pk int')).toEqual([{ name: 'pk', type: 'int', keys: [] }]);
  });
});

describe("a class's rows, read as typed", () => {
  it('draws fields above methods, each in typed order', () => {
    const { fields, methods } = classRows('+ email: string\n+ save(): bool\n- hash: string\n# notify(to: User)');
    expect(fields).toEqual([
      { marker: '+', name: 'email', type: 'string' },
      { marker: '-', name: 'hash', type: 'string' },
    ]);
    expect(methods).toEqual([
      { marker: '+', name: 'save()', type: 'bool' },
      { marker: '#', name: 'notify(to: User)', type: '' },
    ]);
  });

  it('reads a member without a marker or a type, and ~ as package', () => {
    const { fields, methods } = classRows('id\n~ count : int\nrun()');
    expect(fields).toEqual([
      { marker: '', name: 'id', type: '' },
      { marker: '~', name: 'count', type: 'int' },
    ]);
    expect(methods).toEqual([{ marker: '', name: 'run()', type: '' }]);
  });
});

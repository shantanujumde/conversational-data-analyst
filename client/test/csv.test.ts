import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/lib/csv';
import { barAnswer, emptyAnswer } from './fixtures';

describe('toCsv', () => {
  it('writes a header of labels and raw values, CRLF separated', () => {
    expect(toCsv(barAnswer.columns, barAnswer.rows.slice(0, 2))).toBe(
      'Branch,Rejection rate\r\nNorth Point,0.342\r\nHarbour Road,0.268',
    );
  });

  it('quotes commas, quotes, new lines and edge spaces', () => {
    const columns = [{ key: 'name', label: 'Name, full', format: 'text' as const }];
    const rows = [
      { name: 'Rao, Anil' },
      { name: 'The "Big" Shop' },
      { name: 'Line one\nLine two' },
      { name: ' padded ' },
    ];

    expect(toCsv(columns, rows)).toBe(
      [
        '"Name, full"',
        '"Rao, Anil"',
        '"The ""Big"" Shop"',
        '"Line one\nLine two"',
        '" padded "',
      ].join('\r\n'),
    );
  });

  it('defuses text a spreadsheet would run as a formula', () => {
    const columns = [{ key: 'name', label: 'Name', format: 'text' as const }];

    expect(toCsv(columns, [{ name: '=HYPERLINK("x")' }, { name: '@SUM(A1)' }])).toBe(
      'Name\r\n"\'=HYPERLINK(""x"")"\r\n\'@SUM(A1)',
    );
  });

  it('leaves nulls and missing cells empty, and negative numbers alone', () => {
    const columns = [
      { key: 'a', label: 'A', format: 'number' as const },
      { key: 'b', label: 'B', format: 'number' as const },
    ];

    expect(toCsv(columns, [{ a: null }, { a: -5, b: 2 }])).toBe('A,B\r\n,\r\n-5,2');
  });

  it('writes only the header for an empty result', () => {
    expect(toCsv(emptyAnswer.columns, emptyAnswer.rows)).toBe('Applications');
  });
});

import mock from './__mock__';
import { filterFiles, mapCommitData, checkFiles } from '../src/utils';

const testFN = {
  mapCommitData: () => mapCommitData(mock),
  filterFiles: () => filterFiles(mapCommitData(mock), '[".github"]'),
  checkFiles: () => checkFiles(filterFiles(mapCommitData(mock), '[".github"]')),
};

describe('TS-Coverage github actions', () => {
  it('mapCommitData', () => {
    const result = testFN.mapCommitData();

    expect(result[0]).toEqual({
      extension: 'yml',
      status: 'added',
      name: '.github/actions/ts-coverage/action',
    });
    expect(result[10]).toEqual({
      extension: 'js',
      status: 'modified',
      name: '.github/actions/ts-coverage/src/index',
    });
    expect(result[48]).toEqual({
      extension: 'ts',
      status: 'renamed',
      name: 'applications/client/desktop/src/test333',
    });
  });
  it('filterFiles', () => {
    const result = testFN.filterFiles();

    expect(result[0]).toEqual({
      extension: 'ts',
      status: 'added',
      name: 'applications/client/desktop/src/test222',
    });
    expect(result[1]).toEqual({
      extension: 'js',
      status: 'added',
      name: 'applications/client/desktop/src/test333',
    });
    expect(result[3]).toEqual({
      extension: 'ts',
      status: 'renamed',
      name: 'applications/client/desktop/src/test333',
    });
  });
  it('checkFiles', () => {
    const result = testFN.checkFiles();

    expect(result[0]).toEqual({
      extension: 'js',
      status: 'added',
      name: 'applications/client/desktop/src/applications/test12313',
    });
  });
});

import React, { createContext, useContext, useState } from 'react';
import { ExportColumnModal } from '../components/common/ExportColumnModal';

const ExportContext = createContext();

export const ExportProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    columns: [],
    data: [],
    fileName: 'export.xlsx',
    sheetName: 'Sheet1'
  });

  const exportData = (data, columns, fileName = 'export.xlsx', sheetName = 'Sheet1') => {
    setModalState({
      isOpen: true,
      columns,
      data,
      fileName,
      sheetName
    });
  };

  const handleClose = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <ExportContext.Provider value={{ exportData }}>
      {children}
      <ExportColumnModal
        isOpen={modalState.isOpen}
        onClose={handleClose}
        columns={modalState.columns}
        data={modalState.data}
        fileName={modalState.fileName}
        sheetName={modalState.sheetName}
      />
    </ExportContext.Provider>
  );
};

export const useExport = () => {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExport must be used within an ExportProvider');
  }
  return context;
};

import React, { useState, useEffect } from 'react';
import { CSVLink } from 'react-csv';
import { ArrowDownUp, Filter, Download, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { getHistory } from '../services/api';

const HistoryPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      getHistory(address)
        .then(data => {
          const formattedData = data.map((item: any) => ({
            ...item,
            date: new Date(item.createdAt.seconds * 1000).toISOString().split('T')[0],
          }));
          setHistory(formattedData);
          setLoading(false);
        })
        .catch(error => {
          console.error("Failed to fetch history", error);
          setLoading(false);
        });
    }
  }, [isConnected, address]);

  const sortedHistory = React.useMemo(() => {
    let sortableItems = [...history];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [history, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const csvHeaders = [
    { label: "Date", key: "date" },
    { label: "Amount (USDC)", key: "amount" },
    { label: "From Address", key: "senderAddress" },
    { label: "Message", key: "message" },
    { label: "Transaction Hash", key: "txHash" }
  ];

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading History...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Tip History</h1>
          <Link to="/dashboard" className="text-indigo-400 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg">
          <div className="p-4 flex justify-between items-center border-b border-gray-700">
            <div className="flex items-center space-x-2">
                <Filter size={20} className="text-gray-400" />
                <button className="px-4 py-2 bg-gray-700 rounded-md text-sm">This Week</button>
                <button className="px-4 py-2 bg-gray-700 rounded-md text-sm">This Month</button>
                <button className="px-4 py-2 bg-gray-700 rounded-md text-sm">All Time</button>
            </div>
            <CSVLink 
              data={sortedHistory} 
              headers={csvHeaders}
              filename={"tip-history.csv"}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm"
            >
              <Download size={16} />
              <span>Export to CSV</span>
            </CSVLink>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-700 text-xs uppercase">
                <tr>
                  {csvHeaders.map(header => (
                    <th key={header.key} scope="col" className="px-6 py-3">
                      <button onClick={() => requestSort(header.key)} className="flex items-center space-x-1">
                        <span>{header.label}</span>
                        <ArrowDownUp size={14} />
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-6 py-3">View on Explorer</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((item, index) => (
                  <tr key={item.id || index} className="border-b border-gray-700 hover:bg-gray-600">
                    <td className="px-6 py-4">{item.date}</td>
                    <td className="px-6 py-4">${item.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono">{item.senderAddress}</td>
                    <td className="px-6 py-4">{item.message || '-'}</td>
                    <td className="px-6 py-4 font-mono">{item.txHash}</td>
                    <td className="px-6 py-4">
                      <a href={`https://basescan.org/tx/${item.txHash}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage; 
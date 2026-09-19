export default function ChefGareCard({ gare }: any) {
  return (
    <div className="bg-white rounded-2xl p-4 border flex gap-3">
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-black">{gare.chef_nom?.[0] || 'C'}</div>
      <div className="flex-1">
        <p className="font-bold text-sm">{gare.chef_nom || 'Chef de gare'}</p>
        <p className="text-xs text-gray-500">{gare.chef_tel || '-'} • {gare.nom}</p>
        <p className="text-[11px] text-gray-400 mt-1">{gare.adresse}</p>
      </div>
      <div className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded-full h-fit">En service</div>
    </div>
  )
}
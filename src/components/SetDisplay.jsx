import sets from "../data/sets.json";

const SetDisplay = () => {
  return (
    <div className="grid gap-6">
      {Object.entries(sets).map(([setName, set]) => (
        <div key={setName} className="bg-white p-4 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-2">
            {set.chinese_name} ({setName})
          </h2>
          <ul className="space-y-1">
            {set.items.map((item, idx) => (
              <li key={idx}>
                ✅ {item.name_zh} ({item.name})
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default SetDisplay;

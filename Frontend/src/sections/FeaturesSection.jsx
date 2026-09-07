import { Trophy, ShieldCheck, Truck, Headphones } from "lucide-react";

const FeaturesSection = () => {
  const features = [
    {
      icon: <Trophy size={42} />,
      title: "High Quality",
      description: "Crafted from top materials",
    },
    {
      icon: <ShieldCheck size={42} />,
      title: "Warranty Protection",
      description: "Over 2 years",
    },
    {
      icon: <Truck size={42} />,
      title: "Free Shipping",
      description: "Order over $150",
    },
    {
      icon: <Headphones size={42} />,
      title: "24 / 7 Support",
      description: "Dedicated support",
    },
  ];

  return (
    <section className="bg-[#F9F1E7] py-20">
      {/* Wider container than product grid */}
      <div className="max-w-screen-xl mx-auto px-8 lg:px-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-14">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-6"
            >
              <div className="text-gray-800 shrink-0">
                {feature.icon}
              </div>

              <div>
                <h4 className="text-xl font-semibold text-gray-900">
                  {feature.title}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

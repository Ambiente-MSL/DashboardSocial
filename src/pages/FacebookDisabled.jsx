import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";

export default function FacebookDisabled() {
  const outlet = useOutletContext() || {};
  const { setTopbarConfig, resetTopbarConfig } = outlet;

  useEffect(() => {
    setTopbarConfig?.({
      hidden: false,
      title: "Facebook",
      presets: [],
    });
    return () => resetTopbarConfig?.();
  }, [resetTopbarConfig, setTopbarConfig]);

  return (
    <div className="fb-disabled">
      <div className="fb-disabled__card">
        <h2>Monitoramento de Facebook em manutenção</h2>
        <p>
          Estamos concentrando os esforços na experiência do Instagram neste momento. Assim que a coleta de dados do
          Facebook estiver disponível novamente, avisaremos por aqui.
        </p>
        <p className="fb-disabled__tip">
          Continue acompanhando seus indicadores no Instagram — os dados são atualizados automaticamente todos os dias.
        </p>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Modal, Vibration, Platform, KeyboardAvoidingView, DeviceEventEmitter, Image } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import notifee, { TriggerType, AndroidImportance, EventType, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { iniciarBanco, adicionarMedicamento, listarMedicamentos, deletarMedicamento, salvarNomePaciente, obterNomePaciente, Medicamento } from '../../database';

import FormularioCadastro from '../../components/FormularioCadastro';
import ListaAgendamentos from '../../components/ListaAgendamentos';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) DeviceEventEmitter.emit('alarmeBackground', detail.notification);
});

export default function HomeScreen() {
  const [chamadaVisivel, setChamadaVisivel] = useState(false);
  const chamadaAtivaRef = useRef(false);
  const [resumoRemedios, setResumoRemedios] = useState('');
  const [chamadaAtendida, setChamadaAtendida] = useState(false);
  const [pacienteAtual, setPacienteAtual] = useState(''); 
  const somChamada = useRef<Audio.Sound | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'lista'>('cadastro');
  const [nomePacienteGlobal, setNomePacienteGlobal] = useState('');
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  
  const [modalExclusaoVisivel, setModalExclusaoVisivel] = useState(false);
  const [idParaExcluir, setIdParaExcluir] = useState<number | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [modalSucessoVisivel, setModalSucessoVisivel] = useState(false);

  useEffect(() => {
    iniciarBanco();
    setMedicamentos(listarMedicamentos());
    setNomePacienteGlobal(obterNomePaciente()); 
    configurarNotifee();

    const tratarNotificacao = (remedios?: string, paciente?: string) => {
      if (remedios) dispararTelaChamada(remedios, paciente || 'Paciente');
    };

    notifee.getInitialNotification().then(n => {
      if (n) tratarNotificacao(n.notification.data?.remedios as string, n.notification.data?.paciente as string);
    });
    
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        tratarNotificacao(detail.notification?.data?.remedios as string, detail.notification?.data?.paciente as string);
      }
    });

    const subBackground = DeviceEventEmitter.addListener('alarmeBackground', (notification) => {
      tratarNotificacao(notification?.data?.remedios, notification?.data?.paciente);
    });

    return () => { unsubscribe(); subBackground.remove(); };
  }, []);

  async function configurarNotifee() {
    await notifee.requestPermission();
    await notifee.createChannel({ id: 'lembretes_v2', name: 'lembretes', importance: AndroidImportance.HIGH, vibration: true, sound: 'default' });
  }

  async function verificarPermissoesCriticas() {
    if (Platform.OS === 'android') {
      if (await notifee.isBatteryOptimizationEnabled()) {
        Alert.alert('Atenção', 'Desative a otimização de bateria.', [{ text: 'Abrir Configurações', onPress: () => notifee.openBatteryOptimizationSettings() }]);
        return false;
      }
    }
    return true;
  }

  const atualizarPerfilPaciente = (texto: string) => {
    setNomePacienteGlobal(texto);
    salvarNomePaciente(texto);
  };

  const agendarAlarmeReal = async (idNotificacao: string, nomeRemedio: string, dosagem: string, horaBase: Date, offsetHoras: number) => {
    try {
      const dataAlarme = new Date();
      dataAlarme.setHours(horaBase.getHours() + offsetHoras, horaBase.getMinutes(), 0, 0);
      const agora = new Date(); agora.setSeconds(0, 0); 
      if (dataAlarme.getTime() < agora.getTime()) dataAlarme.setDate(dataAlarme.getDate() + 1);
      else if (dataAlarme.getTime() === agora.getTime()) dataAlarme.setSeconds(new Date().getSeconds() + 5);

      await notifee.createTriggerNotification({
        id: idNotificacao, title: 'Hora do medicamento', body: `Toque para atender: ${nomeRemedio}`, 
        data: { remedios: `${nomeRemedio} ${dosagem}`, paciente: nomePacienteGlobal }, 
        android: { channelId: 'lembretes_v2', category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, pressAction: { id: 'default' }, fullScreenAction: { id: 'default' } },
      }, { type: TriggerType.TIMESTAMP, timestamp: dataAlarme.getTime(), alarmManager: { allowWhileIdle: true } });
      return true; 
    } catch { return false; }
  };

  const processarNovoRemedio = async (nome: string, dosagem: string, intervalo: string, horarioForm: string, dateObj: Date) => {
    if (!(await verificarPermissoesCriticas())) return false;
    if (!nome || !dosagem || horarioForm === 'Clique para selecionar') {
      Alert.alert('Erro', 'Preencha todos os campos do medicamento.');
      return false;
    }

    const horarioParaBanco = intervalo ? `${horarioForm} (de ${intervalo} em ${intervalo}h)` : horarioForm;
    const novoId = adicionarMedicamento(nome, dosagem, horarioParaBanco);
    const qtdHoras = parseInt(intervalo) || 0;
    const repeticoes = qtdHoras > 0 ? 3 : 1; 
    
    let deuErro = false;
    for(let i = 0; i < repeticoes; i++) {
      const sucesso = await agendarAlarmeReal(`${novoId}_${i}`, nome, dosagem, dateObj, i * qtdHoras);
      if(!sucesso) deuErro = true;
    }
    
    if (!deuErro) {
      setMedicamentos(listarMedicamentos());
      setModalSucessoVisivel(true);
      return true; 
    } else {
      deletarMedicamento(novoId); 
      Alert.alert('Erro', 'O sistema bloqueou o alarme.');
      return false;
    }
  };

  const perguntarRemover = (id: number) => { setIdParaExcluir(id); setModalExclusaoVisivel(true); };

  const confirmarRemoverRemedio = async () => {
    if (idParaExcluir !== null) {
      deletarMedicamento(idParaExcluir);
      await notifee.cancelNotification(`${idParaExcluir}_0`);
      await notifee.cancelNotification(`${idParaExcluir}_1`);
      await notifee.cancelNotification(`${idParaExcluir}_2`);
      setMedicamentos(listarMedicamentos());
    }
    setModalExclusaoVisivel(false); setIdParaExcluir(null);
  };

  const dispararTelaChamada = async (textoAgrupado: string, pacienteOuvinte: string) => {
    if (chamadaAtivaRef.current) return; 
    chamadaAtivaRef.current = true;
    setChamadaAtendida(false); setChamadaVisivel(true); setResumoRemedios(textoAgrupado || "Seus medicamentos"); setPacienteAtual(pacienteOuvinte); 
    Speech.stop(); Vibration.vibrate([1000, 1000], true);
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' }, { isLooping: true });
      somChamada.current = sound; await sound.playAsync(); 
    } catch {}
  };

  const atenderChamada = async () => {
    Vibration.cancel(); Speech.stop();
    if (somChamada.current) { try { await somChamada.current.stopAsync(); await somChamada.current.unloadAsync(); } catch{} somChamada.current = null; }
    setChamadaAtendida(true);
    Speech.speak(`Alô, ${pacienteAtual}! Está na hora de tomar: ${resumoRemedios}`, { language: 'pt-BR', rate: 0.9 });
  };

  const desligarChamada = async () => { 
    Speech.stop(); Vibration.cancel();
    if (somChamada.current) { try { await somChamada.current.stopAsync(); await somChamada.current.unloadAsync(); } catch{} somChamada.current = null; }
    setChamadaVisivel(false); chamadaAtivaRef.current = false; 
  };

  return (
    <KeyboardAvoidingView style={[styles.container, isDarkMode && styles.containerDark]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      <View style={styles.header}>
        <Image source={require('../../assets/images/logo_cabecalho.png')} style={styles.logoCabecalho} />
        <TouchableOpacity style={styles.botaoTema} onPress={() => setIsDarkMode(!isDarkMode)}>
          <Image 
            source={isDarkMode ? require('../../assets/images/sol_claro.png') : require('../../assets/images/lua_escura.png')} 
            style={styles.iconeTema}
          />
        </TouchableOpacity>
      </View>

      {abaAtiva === 'cadastro' && (
        <FormularioCadastro 
          nomePacienteGlobal={nomePacienteGlobal} 
          atualizarPerfilPaciente={atualizarPerfilPaciente} 
          onSalvar={processarNovoRemedio} 
          isDarkMode={isDarkMode}
          fecharModalSucesso={() => {
            setModalSucessoVisivel(false);
            setAbaAtiva('lista');
          }}
        />
      )}

      {abaAtiva === 'lista' && (
        <ListaAgendamentos 
          medicamentos={medicamentos} 
          perguntarRemover={perguntarRemover} 
          isDarkMode={isDarkMode}
        />
      )}

      <View style={[styles.barraNavegacao, isDarkMode && styles.barraNavegacaoDark]}>
        <TouchableOpacity style={[styles.botaoAba, abaAtiva === 'cadastro' && styles.abaSelecionada]} onPress={() => setAbaAtiva('cadastro')}>
          <Image source={require('../../assets/images/tabs_registro_medicamentos.png')} style={[styles.iconeTab, abaAtiva === 'cadastro' && styles.iconeTabAtiva]} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botaoAba, abaAtiva === 'lista' && styles.abaSelecionada]} onPress={() => setAbaAtiva('lista')}>
          <Image source={require('../../assets/images/tabs_horarios_registrados.png')} style={[styles.iconeTab, abaAtiva === 'lista' && styles.iconeTabAtiva]} />
        </TouchableOpacity>
      </View>

      <Modal visible={modalExclusaoVisivel} transparent={true} animationType="fade">
        <View style={styles.fundoModalEscuro}>
          <View style={[styles.caixinhaModal, isDarkMode && styles.cardDark]}>
            <Text style={[styles.tituloModal, isDarkMode && styles.textoDark]}>Apagar medicamento?</Text>
            <Text style={[styles.textoModal, isDarkMode && styles.subtextoDark]}>Esta ação irá remover o alarme.</Text>
            <View style={styles.botoesModal}>
              <TouchableOpacity style={styles.botaoModalCancelar} onPress={() => setModalExclusaoVisivel(false)}><Text style={styles.textoBotaoModal}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.botaoModalExcluir} onPress={confirmarRemoverRemedio}><Text style={styles.textoBotaoExcluirModal}>Sim, excluir</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalSucessoVisivel} transparent={true} animationType="fade">
        <View style={styles.fundoModalEscuro}>
          <View style={[styles.caixinhaModal, isDarkMode && styles.cardDark, { borderColor: '#28A745', borderWidth: 2 }]}>
            <Image 
              source={require('../../assets/images/logo_medalo.png')} 
              style={{ width: 60, height: 60, marginBottom: 10 }} 
            />
            <Text style={[styles.tituloModal, { color: '#28A745', fontSize: 22 }]}>Sucesso!</Text>
            <Text style={[styles.textoModal, isDarkMode && styles.subtextoDark, { textAlign: 'center', fontSize: 16 }]}>
              O medicamento foi agendado e o alarme está pronto.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: '#28A745', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center', marginTop: 10 }} 
              onPress={() => {
                setModalSucessoVisivel(false);
                setAbaAtiva('lista');
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 18 }}>OK, ENTENDI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={chamadaVisivel} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.telaChamadaContainer}>
          <View style={styles.topoChamada}>
            {!chamadaAtendida && <Text style={styles.textoStatusChamada}>Chamada recebida</Text>}
            <Text style={styles.nomeContato}>Assistente MedAlo</Text><Text style={styles.subContato}>Lembrete para {pacienteAtual}</Text>
          </View>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCiculo}>
              <Image source={require('../../assets/images/logo_medalo.png')} style={styles.logoChamada} />
            </View>
          </View>
          {chamadaAtendida && (
            <View style={styles.infoRemedioArea}>
               <Text style={styles.textoInfoRemedio}>Tomar agora:</Text>
               <Text style={styles.textoRemedioDestaque} numberOfLines={3}>{resumoRemedios.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.rodapeChamada}>
            {!chamadaAtendida ? (
              <View style={styles.botaoWrapper}>
                <TouchableOpacity style={styles.botaoAtenderVerde} onPress={atenderChamada}><Text style={styles.iconeBotaoGeral}>📞</Text></TouchableOpacity>
                <Text style={styles.textoBotaoAcao}>Atender</Text>
              </View>
            ) : (
              <View style={styles.botaoWrapper}>
                <TouchableOpacity style={styles.botaoDesligarVermelho} onPress={desligarChamada}><Text style={styles.iconeBotaoGeral}>✖</Text></TouchableOpacity>
                <Text style={styles.textoBotaoAcao}>Desligar</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: 40 },
  containerDark: { backgroundColor: '#121212' }, 
  
  header: { alignItems: 'center', marginBottom: 15, position: 'relative', minHeight: 60 },
  logoCabecalho: { width: 120, height: 120, resizeMode: 'contain', marginBottom: 5 },
  
  botaoTema: { position: 'absolute', top: 10, right: 20, padding: 5 },
  iconeTema: { width: 32, height: 32, resizeMode: 'contain' },
  
  textoDark: { color: '#FFFFFF' },
  subtextoDark: { color: '#AAAAAA' },
  cardDark: { backgroundColor: '#1E1E1E', borderColor: '#333333' },
  
  barraNavegacao: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DDDDDD', paddingBottom: 20, paddingTop: 10 },
  barraNavegacaoDark: { backgroundColor: '#1E1E1E', borderTopColor: '#333333' },
  botaoAba: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  abaSelecionada: { borderTopWidth: 3, borderTopColor: '#28A745', marginTop: -10, paddingTop: 13 },
  iconeTab: { width: 30, height: 30, resizeMode: 'contain', opacity: 0.5 }, 
  iconeTabAtiva: { opacity: 1, tintColor: '#28A745' }, 

  fundoModalEscuro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  caixinhaModal: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, width: '80%', alignItems: 'center' },
  tituloModal: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 }, 
  textoModal: { color: '#666', marginBottom: 20 },
  botoesModal: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  botaoModalCancelar: { flex: 1, padding: 12, backgroundColor: '#EEE', borderRadius: 5, marginRight: 10, alignItems: 'center' },
  botaoModalExcluir: { flex: 1, padding: 12, backgroundColor: '#DC3545', borderRadius: 5, alignItems: 'center' },
  textoBotaoModal: { color: '#333', fontWeight: 'bold' }, 
  textoBotaoExcluirModal: { color: '#FFF', fontWeight: 'bold' },

  telaChamadaContainer: { flex: 1, backgroundColor: '#1E1E24', paddingTop: 80, paddingBottom: 60, justifyContent: 'space-between' },
  topoChamada: { alignItems: 'center' }, 
  textoStatusChamada: { color: '#A0A0A0', fontSize: 16, marginBottom: 10 },
  nomeContato: { color: '#FFFFFF', fontSize: 32, fontWeight: '300' }, 
  subContato: { color: '#A0A0A0', fontSize: 18, marginTop: 5 },
  avatarContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  avatarCiculo: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, 
  logoChamada: { width: 110, height: 110, resizeMode: 'contain' },
  infoRemedioArea: { alignItems: 'center', paddingHorizontal: 30, marginBottom: 40 },
  textoInfoRemedio: { color: '#A0A0A0', fontSize: 20, marginBottom: 10 }, 
  textoRemedioDestaque: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
  rodapeChamada: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 50 },
  botaoWrapper: { alignItems: 'center' },
  botaoAtenderVerde: { backgroundColor: '#28A745', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', elevation: 5, marginBottom: 10 },
  botaoDesligarVermelho: { backgroundColor: '#DC3545', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', elevation: 5, marginBottom: 10 },
  iconeBotaoGeral: { fontSize: 35, color: '#FFFFFF' },
  textoBotaoAcao: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});